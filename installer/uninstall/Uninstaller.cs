using System;
using System.Diagnostics;
using System.IO;
using Microsoft.Win32;

namespace ComelyLauncherInstaller
{
    internal static class Uninstaller
    {
        private static readonly string[] GameFolderEntries = { "profiles", "instances", "versions", "libraries", "assets", "runtime", "cache" };

        public static bool Run(string directory, bool removeUserData)
        {
            if (!RunningLauncher.TryStop(directory)) return false;
            DeleteFile(InstallLayout.DesktopShortcut);
            DeleteFile(InstallLayout.StartMenuShortcut);
            Registry.CurrentUser.DeleteSubKeyTree(InstallLayout.RegistryKey, false);
            DeleteDirectory(InstallLayout.AppDirectory(directory));
            if (removeUserData) RemoveUserData();
            ScheduleSelfRemoval(directory);
            return true;
        }

        private static void RemoveUserData()
        {
            string folder = InstallLayout.UserDataDirectory;
            if (!Directory.Exists(folder)) return;
            foreach (string entry in Directory.GetFileSystemEntries(folder))
            {
                if (Array.IndexOf(GameFolderEntries, Path.GetFileName(entry).ToLowerInvariant()) >= 0) continue;
                DeleteFile(entry);
                DeleteDirectory(entry);
            }
            try
            {
                if (Directory.GetFileSystemEntries(folder).Length == 0) Directory.Delete(folder);
            }
            catch (IOException)
            {
            }
            catch (UnauthorizedAccessException)
            {
            }
        }

        private static void ScheduleSelfRemoval(string directory)
        {
            string uninstaller = Path.Combine(directory, InstallLayout.UninstallerName);
            string command = "/c ping -n 3 127.0.0.1 >nul & del /f /q \"" + uninstaller + "\" & rmdir \"" + directory + "\"";
            Process.Start(new ProcessStartInfo("cmd.exe", command) { CreateNoWindow = true, UseShellExecute = false, WindowStyle = ProcessWindowStyle.Hidden });
        }

        private static void DeleteFile(string path)
        {
            try
            {
                if (File.Exists(path)) File.Delete(path);
            }
            catch (IOException)
            {
            }
            catch (UnauthorizedAccessException)
            {
            }
        }

        private static void DeleteDirectory(string path)
        {
            try
            {
                if (Directory.Exists(path)) Directory.Delete(path, true);
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
