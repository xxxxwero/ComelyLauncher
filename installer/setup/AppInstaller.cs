using System;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Security.AccessControl;
using System.Security.Principal;
using System.Text;
using System.Threading;
using Microsoft.Win32;

namespace ComelyLauncherInstaller
{
    internal sealed class InstallOptions
    {
        public string Directory;
        public bool DesktopShortcut;
        public bool StartMenuShortcut;
        public bool KeepExistingShortcuts;
    }

    internal sealed class GameRunningException : Exception
    {
    }

    internal sealed class ForeignFolderException : Exception
    {
        public ForeignFolderException(string path) : base(path)
        {
        }
    }

    internal static class AppInstaller
    {
        private const string ArchiveResource = "payload.zip";
        private const string VersionResource = "version.txt";
        private const string UninstallerResource = "uninstall.exe";
        private const string AllApplicationPackagesSid = "S-1-15-2-1";
        private const string RepositoryUrl = "https://github.com/xxxxwero/ComelyLauncher";
        private const int SwapAttempts = 10;
        private const int SwapRetryMs = 400;

        public static string Version
        {
            get
            {
                using (Stream stream = Assembly.GetExecutingAssembly().GetManifestResourceStream(VersionResource))
                using (StreamReader reader = new StreamReader(stream, Encoding.UTF8))
                {
                    return reader.ReadToEnd().Trim();
                }
            }
        }

        public static void Install(InstallOptions options, Action<double> onProgress)
        {
            string directory = options.Directory;
            string appDirectory = InstallLayout.AppDirectory(directory);
            bool replacesLegacy = SamePath(appDirectory, InstallLayout.LegacyRoot);
            if (!replacesLegacy && Directory.Exists(appDirectory) && !File.Exists(Path.Combine(appDirectory, InstallLayout.MarkerName))) throw new ForeignFolderException(appDirectory);
            if (!RunningLauncher.TryStop(directory, InstallLayout.LegacyRoot)) throw new GameRunningException();
            Directory.CreateDirectory(directory);
            string staged = appDirectory + ".new";
            DeleteQuietly(staged);
            Directory.CreateDirectory(staged);
            GrantSandboxAccess(staged);
            Extract(staged, onProgress);
            File.WriteAllText(Path.Combine(staged, InstallLayout.MarkerName), Version);
            try
            {
                Swap(staged, appDirectory);
            }
            catch (Exception)
            {
                DeleteQuietly(staged);
                throw;
            }
            WriteUninstaller(directory);
            UpdateShortcuts(options);
            Register(directory);
            if (!replacesLegacy) RemoveLegacyInstall();
        }

        private static bool SamePath(string first, string second)
        {
            return string.Equals(Path.GetFullPath(first).TrimEnd(Path.DirectorySeparatorChar), Path.GetFullPath(second).TrimEnd(Path.DirectorySeparatorChar), StringComparison.OrdinalIgnoreCase);
        }

        private static void Extract(string target, Action<double> onProgress)
        {
            using (Stream stream = Assembly.GetExecutingAssembly().GetManifestResourceStream(ArchiveResource))
            using (ZipArchive archive = new ZipArchive(stream, ZipArchiveMode.Read))
            {
                long totalBytes = 0;
                foreach (ZipArchiveEntry entry in archive.Entries) totalBytes += entry.Length;
                long doneBytes = 0;
                string root = Path.GetFullPath(target) + Path.DirectorySeparatorChar;
                foreach (ZipArchiveEntry entry in archive.Entries)
                {
                    string path = Path.GetFullPath(Path.Combine(target, entry.FullName));
                    if (!path.StartsWith(root, StringComparison.OrdinalIgnoreCase)) continue;
                    if (string.IsNullOrEmpty(entry.Name))
                    {
                        Directory.CreateDirectory(path);
                        continue;
                    }
                    Directory.CreateDirectory(Path.GetDirectoryName(path));
                    entry.ExtractToFile(path, true);
                    doneBytes += entry.Length;
                    if (totalBytes > 0) onProgress((double)doneBytes / totalBytes);
                }
            }
        }

        private static void Swap(string staged, string appDirectory)
        {
            string previous = appDirectory + ".old";
            DeleteQuietly(previous);
            bool hadPrevious = Directory.Exists(appDirectory);
            if (hadPrevious) MoveWithRetries(appDirectory, previous);
            try
            {
                MoveWithRetries(staged, appDirectory);
            }
            catch (Exception)
            {
                if (hadPrevious) MoveWithRetries(previous, appDirectory);
                throw;
            }
            DeleteQuietly(previous);
        }

        private static void MoveWithRetries(string source, string target)
        {
            for (int attempt = 1; ; attempt++)
            {
                try
                {
                    Directory.Move(source, target);
                    return;
                }
                catch (Exception error)
                {
                    if (!(error is IOException || error is UnauthorizedAccessException) || attempt >= SwapAttempts) throw;
                    Thread.Sleep(SwapRetryMs);
                }
            }
        }

        private static void WriteUninstaller(string directory)
        {
            string target = Path.Combine(directory, InstallLayout.UninstallerName);
            using (Stream stream = Assembly.GetExecutingAssembly().GetManifestResourceStream(UninstallerResource))
            using (FileStream output = new FileStream(target, FileMode.Create, FileAccess.Write))
            {
                stream.CopyTo(output);
            }
        }

        private static void UpdateShortcuts(InstallOptions options)
        {
            string executable = InstallLayout.Executable(options.Directory);
            bool desktop = options.KeepExistingShortcuts ? File.Exists(InstallLayout.DesktopShortcut) : options.DesktopShortcut;
            bool startMenu = options.KeepExistingShortcuts ? File.Exists(InstallLayout.StartMenuShortcut) : options.StartMenuShortcut;
            if (desktop) CreateShortcut(InstallLayout.DesktopShortcut, executable);
            if (startMenu) CreateShortcut(InstallLayout.StartMenuShortcut, executable);
        }

        private static void CreateShortcut(string shortcutPath, string target)
        {
            Directory.CreateDirectory(Path.GetDirectoryName(shortcutPath));
            Type shellType = Type.GetTypeFromProgID("WScript.Shell");
            object shell = Activator.CreateInstance(shellType);
            object shortcut = shellType.InvokeMember("CreateShortcut", BindingFlags.InvokeMethod, null, shell, new object[] { shortcutPath });
            Type shortcutType = shortcut.GetType();
            shortcutType.InvokeMember("TargetPath", BindingFlags.SetProperty, null, shortcut, new object[] { target });
            shortcutType.InvokeMember("WorkingDirectory", BindingFlags.SetProperty, null, shortcut, new object[] { Path.GetDirectoryName(target) });
            shortcutType.InvokeMember("IconLocation", BindingFlags.SetProperty, null, shortcut, new object[] { target + ",0" });
            shortcutType.InvokeMember("Description", BindingFlags.SetProperty, null, shortcut, new object[] { "ComelyLauncher" });
            shortcutType.InvokeMember("Save", BindingFlags.InvokeMethod, null, shortcut, null);
        }

        private static void Register(string directory)
        {
            using (RegistryKey key = Registry.CurrentUser.CreateSubKey(InstallLayout.RegistryKey))
            {
                string uninstaller = Path.Combine(directory, InstallLayout.UninstallerName);
                key.SetValue("DisplayName", InstallLayout.ProductName);
                key.SetValue("DisplayVersion", Version);
                key.SetValue("Publisher", InstallLayout.ProductName);
                key.SetValue("DisplayIcon", InstallLayout.Executable(directory));
                key.SetValue("InstallLocation", directory);
                key.SetValue("UninstallString", "\"" + uninstaller + "\"");
                key.SetValue("URLInfoAbout", RepositoryUrl);
                key.SetValue("HelpLink", RepositoryUrl);
                key.SetValue("NoModify", 1, RegistryValueKind.DWord);
                key.SetValue("NoRepair", 1, RegistryValueKind.DWord);
                key.SetValue("EstimatedSize", (int)((DirectorySize(InstallLayout.AppDirectory(directory)) + new FileInfo(uninstaller).Length) / 1024), RegistryValueKind.DWord);
            }
        }

        private static long DirectorySize(string directory)
        {
            long total = 0;
            foreach (string file in Directory.EnumerateFiles(directory, "*", SearchOption.AllDirectories)) total += new FileInfo(file).Length;
            return total;
        }

        private static void RemoveLegacyInstall()
        {
            DeleteQuietly(InstallLayout.LegacyRoot);
            string parent = Path.GetDirectoryName(InstallLayout.LegacyRoot);
            try
            {
                if (Directory.Exists(parent) && Directory.GetFileSystemEntries(parent).Length == 0) Directory.Delete(parent);
            }
            catch (IOException)
            {
            }
            catch (UnauthorizedAccessException)
            {
            }
        }

        private static void GrantSandboxAccess(string directory)
        {
            DirectorySecurity security = Directory.GetAccessControl(directory);
            security.AddAccessRule(new FileSystemAccessRule(
                new SecurityIdentifier(AllApplicationPackagesSid),
                FileSystemRights.ReadAndExecute,
                InheritanceFlags.ContainerInherit | InheritanceFlags.ObjectInherit,
                PropagationFlags.None,
                AccessControlType.Allow));
            Directory.SetAccessControl(directory, security);
        }

        private static void DeleteQuietly(string directory)
        {
            try
            {
                if (Directory.Exists(directory)) Directory.Delete(directory, true);
            }
            catch (IOException)
            {
            }
            catch (UnauthorizedAccessException)
            {
            }
        }
    }
}
