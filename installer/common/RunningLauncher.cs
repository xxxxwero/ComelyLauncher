using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.Management;
using System.Runtime.InteropServices;

namespace ComelyLauncherInstaller
{
    internal static class RunningLauncher
    {
        private const string ProcessName = "ComelyLauncher";
        private const string GameProcessName = "javaw.exe";
        private const int ExitTimeoutMs = 5000;

        public static bool TryStop(params string[] roots)
        {
            List<Process> running = FindIn(roots);
            if (IsGameRunning(running)) return false;
            foreach (Process process in running) TryKill(process);
            foreach (Process process in running) TryWait(process);
            return true;
        }

        private static List<Process> FindIn(string[] roots)
        {
            List<Process> result = new List<Process>();
            foreach (Process process in Process.GetProcessesByName(ProcessName))
            {
                string path = TryGetPath(process);
                if (path == null) continue;
                foreach (string root in roots)
                {
                    string prefix = Path.GetFullPath(root).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
                    if (!path.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)) continue;
                    result.Add(process);
                    break;
                }
            }
            return result;
        }

        private static string TryGetPath(Process process)
        {
            try
            {
                return process.MainModule.FileName;
            }
            catch (Win32Exception)
            {
                return null;
            }
            catch (InvalidOperationException)
            {
                return null;
            }
        }

        private static bool IsGameRunning(List<Process> launchers)
        {
            try
            {
                foreach (Process launcher in launchers)
                {
                    string query = "SELECT ProcessId FROM Win32_Process WHERE Name='" + GameProcessName + "' AND ParentProcessId=" + launcher.Id;
                    using (ManagementObjectSearcher searcher = new ManagementObjectSearcher(query))
                    using (ManagementObjectCollection games = searcher.Get())
                    {
                        if (games.Count > 0) return true;
                    }
                }
                return false;
            }
            catch (ManagementException)
            {
                return true;
            }
            catch (COMException)
            {
                return true;
            }
        }

        private static void TryKill(Process process)
        {
            try
            {
                process.Kill();
            }
            catch (Win32Exception)
            {
            }
            catch (InvalidOperationException)
            {
            }
        }

        private static void TryWait(Process process)
        {
            try
            {
                process.WaitForExit(ExitTimeoutMs);
            }
            catch (Win32Exception)
            {
            }
            catch (InvalidOperationException)
            {
            }
        }
    }
}
