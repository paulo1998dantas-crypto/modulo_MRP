using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Net;
using System.Net.Sockets;
using System.Reflection;
using System.Text;
using System.Threading;
using System.Windows.Forms;

internal static class MrpLauncher
{
    private const string ProductName = "MRP JI";
    private const string PayloadResource = "MrpPayload";
    private const string VersionResource = "MrpPayloadVersion";
    private const string MutexPrefix = @"Local\JI_Montadora_MRP_";
    private const int FirstPort = 38471;
    private const int LastPort = 38489;

    private static readonly object LogLock = new object();

    [STAThread]
    private static void Main()
    {
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);

        var payloadVersion = ReadEmbeddedText(VersionResource).Trim();
        bool ownsMutex;
        using (var mutex = new Mutex(true, MutexPrefix + payloadVersion, out ownsMutex))
        {
            var dataRoot = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "JI Montadora",
                "Modulo MRP");
            Directory.CreateDirectory(dataRoot);

            var portFile = Path.Combine(dataRoot, "current-port-" + payloadVersion + ".txt");
            if (!ownsMutex)
            {
                var deadline = DateTime.UtcNow.AddSeconds(12);
                while (DateTime.UtcNow < deadline)
                {
                    var existingUrl = ReadRunningUrl(portFile);
                    if (existingUrl != null)
                    {
                        OpenApplication(existingUrl);
                        return;
                    }

                    Thread.Sleep(250);
                }

                MessageBox.Show(
                    "O MRP já está iniciando. Aguarde alguns segundos e tente novamente.",
                    ProductName,
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Information);
                return;
            }

            Process serverProcess = null;
            try
            {
                var payloadRoot = EnsurePayload(dataRoot, payloadVersion);

                var runningUrl = ReadRunningUrl(portFile);
                var port = runningUrl == null ? FindAvailablePort() : new Uri(runningUrl).Port;
                var url = "http://127.0.0.1:" + port + "/";

                if (runningUrl == null)
                {
                    serverProcess = StartServer(payloadRoot, port, dataRoot);
                    if (!WaitForServer(url, serverProcess, TimeSpan.FromSeconds(35)))
                    {
                        throw new InvalidOperationException(
                            "O servidor local não respondeu dentro do tempo esperado.");
                    }
                }

                File.WriteAllText(portFile, port.ToString(), Encoding.ASCII);
                OpenApplication(url);
                Application.Run(new MrpTrayContext(serverProcess, url, portFile));
            }
            catch (Exception ex)
            {
                StopServer(serverProcess);
                var logPath = Path.Combine(dataRoot, "launcher-error.log");
                File.AppendAllText(
                    logPath,
                    DateTime.Now.ToString("s") + Environment.NewLine + ex + Environment.NewLine);

                MessageBox.Show(
                    "Não foi possível iniciar o MRP.\n\nDetalhes foram gravados em:\n" + logPath,
                    ProductName,
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error);
            }
        }
    }

    private static string EnsurePayload(string dataRoot, string payloadVersion)
    {
        var payloadRoot = Path.Combine(dataRoot, "app-" + payloadVersion);
        var readyFile = Path.Combine(payloadRoot, ".ready");
        if (File.Exists(readyFile))
        {
            return payloadRoot;
        }

        var temporaryRoot = payloadRoot + ".tmp-" + Guid.NewGuid().ToString("N");
        Directory.CreateDirectory(temporaryRoot);

        try
        {
            using (var payloadStream = Assembly.GetExecutingAssembly()
                .GetManifestResourceStream(PayloadResource))
            {
                if (payloadStream == null)
                {
                    throw new InvalidOperationException("Pacote interno do MRP não encontrado.");
                }

                using (var archive = new ZipArchive(payloadStream, ZipArchiveMode.Read))
                {
                    archive.ExtractToDirectory(temporaryRoot);
                }
            }

            File.WriteAllText(Path.Combine(temporaryRoot, ".ready"), payloadVersion);
            if (Directory.Exists(payloadRoot))
            {
                Directory.Delete(payloadRoot, true);
            }

            Directory.Move(temporaryRoot, payloadRoot);
        }
        catch
        {
            if (Directory.Exists(temporaryRoot))
            {
                Directory.Delete(temporaryRoot, true);
            }

            throw;
        }

        return payloadRoot;
    }

    private static Process StartServer(string payloadRoot, int port, string dataRoot)
    {
        var nodePath = Path.Combine(payloadRoot, "runtime", "node.exe");
        var serverPath = Path.Combine(payloadRoot, "server.mjs");
        if (!File.Exists(nodePath) || !File.Exists(serverPath))
        {
            throw new FileNotFoundException("O pacote do servidor local está incompleto.");
        }

        var startInfo = new ProcessStartInfo
        {
            FileName = nodePath,
            Arguments = Quote(serverPath),
            WorkingDirectory = payloadRoot,
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true
        };
        startInfo.EnvironmentVariables["MRP_PORT"] = port.ToString();
        startInfo.EnvironmentVariables["NODE_ENV"] = "production";

        var logPath = Path.Combine(dataRoot, "server.log");
        var process = new Process
        {
            StartInfo = startInfo,
            EnableRaisingEvents = true
        };
        process.OutputDataReceived += delegate(object sender, DataReceivedEventArgs args)
        {
            AppendLog(logPath, args.Data);
        };
        process.ErrorDataReceived += delegate(object sender, DataReceivedEventArgs args)
        {
            AppendLog(logPath, args.Data);
        };

        if (!process.Start())
        {
            throw new InvalidOperationException("Não foi possível iniciar o servidor local.");
        }

        process.BeginOutputReadLine();
        process.BeginErrorReadLine();
        return process;
    }

    private static bool WaitForServer(string url, Process process, TimeSpan timeout)
    {
        var deadline = DateTime.UtcNow.Add(timeout);
        while (DateTime.UtcNow < deadline)
        {
            if (process != null && process.HasExited)
            {
                return false;
            }

            if (IsMrpRunning(url))
            {
                return true;
            }

            Thread.Sleep(250);
        }

        return false;
    }

    private static string ReadRunningUrl(string portFile)
    {
        int port;
        if (!File.Exists(portFile)
            || !int.TryParse(File.ReadAllText(portFile).Trim(), out port))
        {
            return null;
        }

        var url = "http://127.0.0.1:" + port + "/";
        return IsMrpRunning(url) ? url : null;
    }

    private static bool IsMrpRunning(string url)
    {
        try
        {
            var request = (HttpWebRequest)WebRequest.Create(url);
            request.Timeout = 900;
            request.ReadWriteTimeout = 900;
            request.UserAgent = ProductName;
            using (var response = (HttpWebResponse)request.GetResponse())
            using (var reader = new StreamReader(response.GetResponseStream()))
            {
                var html = reader.ReadToEnd();
                return response.StatusCode == HttpStatusCode.OK
                    && html.IndexOf("Módulo MRP", StringComparison.OrdinalIgnoreCase) >= 0;
            }
        }
        catch
        {
            return false;
        }
    }

    private static int FindAvailablePort()
    {
        for (var port = FirstPort; port <= LastPort; port++)
        {
            TcpListener listener = null;
            try
            {
                listener = new TcpListener(IPAddress.Loopback, port);
                listener.Start();
                return port;
            }
            catch (SocketException)
            {
            }
            finally
            {
                if (listener != null)
                {
                    listener.Stop();
                }
            }
        }

        throw new InvalidOperationException("Não há uma porta local livre para iniciar o MRP.");
    }

    internal static void OpenApplication(string url)
    {
        var edgeCandidates = new[]
        {
            Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86),
                "Microsoft", "Edge", "Application", "msedge.exe"),
            Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),
                "Microsoft", "Edge", "Application", "msedge.exe")
        };

        foreach (var edgePath in edgeCandidates)
        {
            if (!File.Exists(edgePath))
            {
                continue;
            }

            Process.Start(new ProcessStartInfo
            {
                FileName = edgePath,
                Arguments = "--app=" + Quote(url) + " --start-maximized",
                UseShellExecute = true
            });
            return;
        }

        Process.Start(new ProcessStartInfo
        {
            FileName = url,
            UseShellExecute = true
        });
    }

    private static string ReadEmbeddedText(string resourceName)
    {
        using (var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream(resourceName))
        {
            if (stream == null)
            {
                throw new InvalidOperationException("Versão interna do MRP não encontrada.");
            }

            using (var reader = new StreamReader(stream, Encoding.UTF8))
            {
                return reader.ReadToEnd();
            }
        }
    }

    private static void AppendLog(string path, string line)
    {
        if (String.IsNullOrEmpty(line))
        {
            return;
        }

        lock (LogLock)
        {
            File.AppendAllText(path, DateTime.Now.ToString("s") + " " + line + Environment.NewLine);
        }
    }

    private static string Quote(string value)
    {
        return "\"" + value.Replace("\"", "\\\"") + "\"";
    }

    internal static void StopServer(Process process)
    {
        if (process == null)
        {
            return;
        }

        try
        {
            if (!process.HasExited)
            {
                process.Kill();
                process.WaitForExit(3000);
            }
        }
        catch
        {
        }
        finally
        {
            process.Dispose();
        }
    }
}

internal sealed class MrpTrayContext : ApplicationContext
{
    private readonly Process serverProcess;
    private readonly string url;
    private readonly string portFile;
    private readonly NotifyIcon notifyIcon;

    internal MrpTrayContext(Process serverProcess, string url, string portFile)
    {
        this.serverProcess = serverProcess;
        this.url = url;
        this.portFile = portFile;

        var menu = new ContextMenuStrip();
        menu.Items.Add("Abrir MRP", null, delegate { OpenMrp(); });
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add("Encerrar", null, delegate { ExitThread(); });

        notifyIcon = new NotifyIcon
        {
            Icon = SystemIcons.Application,
            Text = "MRP JI em execução",
            ContextMenuStrip = menu,
            Visible = true
        };
        notifyIcon.DoubleClick += delegate { OpenMrp(); };
        notifyIcon.ShowBalloonTip(
            2500,
            "MRP JI",
            "O sistema está em execução. Clique duas vezes neste ícone para reabrir.",
            ToolTipIcon.Info);
    }

    private void OpenMrp()
    {
        MrpLauncher.OpenApplication(url);
    }

    protected override void ExitThreadCore()
    {
        notifyIcon.Visible = false;
        notifyIcon.Dispose();
        MrpLauncher.StopServer(serverProcess);

        try
        {
            if (File.Exists(portFile))
            {
                File.Delete(portFile);
            }
        }
        catch
        {
        }

        base.ExitThreadCore();
    }
}
