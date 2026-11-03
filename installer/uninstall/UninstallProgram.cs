using System;
using System.IO;
using System.Reflection;
using System.Windows.Forms;

namespace ComelyLauncherInstaller
{
    internal static class UninstallProgram
    {
        private const string SilentArgument = "--silent";
        private const string RemoveDataArgument = "--remove-data";

        [STAThread]
        private static int Main(string[] args)
        {
            string directory = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location);
#if INSTALLER_TEST
            foreach (string arg in args)
            {
                if (!arg.StartsWith("--shots=", StringComparison.Ordinal)) continue;
                using (UninstallForm form = new UninstallForm(directory)) form.SaveShot(arg.Substring("--shots=".Length));
                return 0;
            }
#endif
            string appDirectory = InstallLayout.AppDirectory(directory);
            if (Directory.Exists(appDirectory) && !File.Exists(Path.Combine(appDirectory, InstallLayout.MarkerName)))
            {
                if (!Has(args, SilentArgument)) MessageBox.Show(InstallerTheme.Text("Лаунчер в этой папке не найден.", "The launcher was not found in this folder."), InstallLayout.ProductName);
                return 3;
            }
            if (Has(args, SilentArgument))
            {
                if (!Uninstaller.Run(directory, Has(args, RemoveDataArgument))) return 2;
                return 0;
            }
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            using (UninstallForm form = new UninstallForm(directory)) Application.Run(form);
            return 0;
        }

        private static bool Has(string[] args, string name)
        {
            foreach (string arg in args)
            {
                if (string.Equals(arg, name, StringComparison.OrdinalIgnoreCase)) return true;
            }
            return false;
        }
    }
}
