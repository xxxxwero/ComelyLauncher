using System;
using System.IO;
using Microsoft.Win32;

namespace ComelyLauncherInstaller
{
    internal static class InstallLayout
    {
        public const string ProductName = "ComelyLauncher";
        public const string AppFolderName = "app";
        public const string ExecutableName = "ComelyLauncher.exe";
        public const string UninstallerName = "Uninstall.exe";
        public const string MarkerName = ".comely-install";
        private const string LocationValue = "InstallLocation";

#if INSTALLER_TEST
        private const string TestRootVariable = "COMELY_INSTALLER_TEST_ROOT";

        private static string TestRoot
        {
            get
            {
                string root = Environment.GetEnvironmentVariable(TestRootVariable);
                if (string.IsNullOrEmpty(root)) throw new InvalidOperationException(TestRootVariable + " is required in a test build");
                return root;
            }
        }

        public const string RegistryKey = @"Software\ComelyLauncherInstallerTest\" + ProductName;
        private static string LocalData { get { return Path.Combine(TestRoot, "local"); } }
        private static string RoamingData { get { return Path.Combine(TestRoot, "roaming"); } }
        private static string DesktopFolder { get { return Path.Combine(TestRoot, "desktop"); } }
        private static string ProgramsFolder { get { return Path.Combine(TestRoot, "startmenu"); } }
#else
        public const string RegistryKey = @"Software\Microsoft\Windows\CurrentVersion\Uninstall\" + ProductName;
        private static string LocalData { get { return Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData); } }
        private static string RoamingData { get { return Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData); } }
        private static string DesktopFolder { get { return Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory); } }
        private static string ProgramsFolder { get { return Environment.GetFolderPath(Environment.SpecialFolder.Programs); } }
#endif

        public static string DefaultDirectory { get { return Path.Combine(LocalData, "Programs", ProductName); } }
        public static string LegacyRoot { get { return Path.Combine(LocalData, ProductName, AppFolderName); } }
        public static string UserDataDirectory { get { return Path.Combine(RoamingData, ProductName); } }
        public static string DesktopShortcut { get { return Path.Combine(DesktopFolder, ProductName + ".lnk"); } }
        public static string StartMenuShortcut { get { return Path.Combine(ProgramsFolder, ProductName + ".lnk"); } }

        public static string Normalize(string directory)
        {
            string full = Path.GetFullPath(directory.Trim()).TrimEnd(Path.DirectorySeparatorChar);
            if (full.EndsWith(":", StringComparison.Ordinal)) full += Path.DirectorySeparatorChar;
            bool dedicated = string.Equals(Path.GetFileName(full), ProductName, StringComparison.OrdinalIgnoreCase);
            return dedicated ? full : Path.Combine(full, ProductName);
        }

        public static string AppDirectory(string installDirectory)
        {
            return Path.Combine(installDirectory, AppFolderName);
        }

        public static string Executable(string installDirectory)
        {
            return Path.Combine(AppDirectory(installDirectory), ExecutableName);
        }

        public static string RegisteredLocation()
        {
            using (RegistryKey key = Registry.CurrentUser.OpenSubKey(RegistryKey))
            {
                string location = key == null ? null : key.GetValue(LocationValue) as string;
                return !string.IsNullOrEmpty(location) && File.Exists(Path.Combine(AppDirectory(location), MarkerName)) ? location : null;
            }
        }

        public static string RegisteredVersion()
        {
            using (RegistryKey key = Registry.CurrentUser.OpenSubKey(RegistryKey))
            {
                return key == null ? null : key.GetValue("DisplayVersion") as string;
            }
        }
    }
}
