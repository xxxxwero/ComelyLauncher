using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;

namespace ComelyLauncherInstaller
{
    internal static class Program
    {
        private const string UpdateArgument = "--update";
        private const string SilentArgument = "--silent";
        private const string DirectoryArgument = "--dir=";
        private const string NoDesktopArgument = "--no-desktop";
        private const string NoLaunchArgument = "--no-launch";
#if INSTALLER_TEST
        private const string ShotsArgument = "--shots=";
#endif

        [STAThread]
        private static int Main(string[] args)
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            bool update = HasArgument(args, UpdateArgument);
            bool silent = HasArgument(args, SilentArgument);
            string chosen = ArgumentValue(args, DirectoryArgument);
#if INSTALLER_TEST
            string shots = ArgumentValue(args, ShotsArgument);
            if (shots != null)
            {
                using (InstallerForm form = new InstallerForm(InstallLayout.DefaultDirectory, null, false)) form.SavePages(shots);
                return 0;
            }
#endif
            string registered = InstallLayout.RegisteredLocation();
            string directory = chosen != null ? InstallLayout.Normalize(chosen) : registered ?? InstallLayout.DefaultDirectory;

            if (silent) return RunSilently(directory, registered != null, HasArgument(args, NoDesktopArgument), !HasArgument(args, NoLaunchArgument));
            using (InstallerForm form = new InstallerForm(directory, registered != null ? InstallLayout.RegisteredVersion() : null, update))
            {
                Application.Run(form);
            }
            return 0;
        }

        internal static void Launch(string directory)
        {
            string executable = InstallLayout.Executable(directory);
            ProcessStartInfo start = new ProcessStartInfo(executable) { WorkingDirectory = Path.GetDirectoryName(executable), UseShellExecute = false };
#if INSTALLER_TEST
            start.Arguments = Environment.GetEnvironmentVariable("COMELY_INSTALLER_TEST_LAUNCH_ARGS") ?? string.Empty;
#endif
            Process.Start(start);
        }

        private static int RunSilently(string directory, bool update, bool noDesktop, bool launch)
        {
            try
            {
                AppInstaller.Install(new InstallOptions { Directory = directory, DesktopShortcut = !noDesktop, StartMenuShortcut = true, KeepExistingShortcuts = update }, delegate { });
                if (launch) Launch(directory);
                return 0;
            }
            catch (GameRunningException)
            {
                return 2;
            }
            catch (ForeignFolderException)
            {
                return 3;
            }
            catch (UnauthorizedAccessException)
            {
                return 4;
            }
            catch (IOException)
            {
                return 5;
            }
        }

        private static bool HasArgument(string[] args, string name)
        {
            foreach (string arg in args)
            {
                if (string.Equals(arg, name, StringComparison.OrdinalIgnoreCase)) return true;
            }
            return false;
        }

        private static string ArgumentValue(string[] args, string prefix)
        {
            foreach (string arg in args)
            {
                if (arg.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)) return arg.Substring(prefix.Length);
            }
            return null;
        }
    }
}
