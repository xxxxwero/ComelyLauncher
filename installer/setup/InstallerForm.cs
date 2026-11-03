using System;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.Threading;
using System.Windows.Forms;

namespace ComelyLauncherInstaller
{
    internal sealed partial class InstallerForm : Form
    {
        private enum Page
        {
            Options,
            Progress,
            Done
        }

        private const int WindowWidth = 620;
        private const int WindowHeight = 430;
        private const int Side = 40;
        private const int WindowAppearTimeoutMs = 8000;

        private readonly Image logo = InstallerTheme.LoadLogo();
        private readonly System.Windows.Forms.Timer animation = new System.Windows.Forms.Timer { Interval = 16 };
        private readonly Stopwatch clock = Stopwatch.StartNew();
        private readonly string installedVersion;
        private readonly bool updateOnly;
        private readonly Panel pathBox = new Panel();
        private readonly TextBox pathInput = new TextBox();
        private readonly FlatButton browse = new FlatButton();
        private readonly FlatCheck desktop = new FlatCheck();
        private readonly FlatCheck startMenu = new FlatCheck();
        private readonly FlatButton install = new FlatButton { Primary = true };
        private readonly FlatButton cancel = new FlatButton();
        private readonly FlatButton launch = new FlatButton { Primary = true };
        private readonly FlatButton close = new FlatButton();
        private Page page = Page.Options;
        private double targetProgress;
        private double shownProgress;
        private string installedDirectory;
        private Point dragStart;
        private bool dragging;
        private bool installing;

        public InstallerForm(string directory, string installedVersion, bool updateOnly)
        {
            this.installedVersion = installedVersion;
            this.updateOnly = updateOnly;
            Text = InstallerTheme.Text("Установка ComelyLauncher", "ComelyLauncher Setup");
            FormBorderStyle = FormBorderStyle.None;
            StartPosition = FormStartPosition.CenterScreen;
#if INSTALLER_TEST
            StartPosition = FormStartPosition.Manual;
            Location = new Point(-4000, -4000);
#endif
            ClientSize = new Size(WindowWidth, WindowHeight);
            BackColor = InstallerTheme.Background;
            ForeColor = Color.White;
            DoubleBuffered = true;
            KeyPreview = true;
            Icon = Icon.ExtractAssociatedIcon(System.Reflection.Assembly.GetExecutingAssembly().Location);
            animation.Tick += delegate
            {
                shownProgress += (Volatile.Read(ref targetProgress) - shownProgress) * 0.14;
                Invalidate();
            };
            BuildOptions(directory);
            BuildDone();
            ShowPage(updateOnly ? Page.Progress : Page.Options);
        }

        protected override void OnShown(EventArgs e)
        {
            base.OnShown(e);
            if (updateOnly) StartInstall();
            else install.Focus();
        }

        protected override void OnKeyDown(KeyEventArgs e)
        {
            if (e.KeyCode == Keys.Escape && page != Page.Progress) Close();
            base.OnKeyDown(e);
        }

        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            if (installing) e.Cancel = true;
            base.OnFormClosing(e);
        }

        protected override void OnMouseDown(MouseEventArgs e)
        {
            dragging = e.Button == MouseButtons.Left;
            dragStart = e.Location;
            base.OnMouseDown(e);
        }

        protected override void OnMouseMove(MouseEventArgs e)
        {
            if (dragging) Location = new Point(Location.X + e.X - dragStart.X, Location.Y + e.Y - dragStart.Y);
            base.OnMouseMove(e);
        }

        protected override void OnMouseUp(MouseEventArgs e)
        {
            dragging = false;
            base.OnMouseUp(e);
        }

        private bool IsUpgrade
        {
            get { return installedVersion != null; }
        }

        private void BuildOptions(string directory)
        {
            pathBox.SetBounds(Side, 196, WindowWidth - Side * 2 - 112, 40);
            pathBox.BackColor = InstallerTheme.Surface;
            pathInput.BorderStyle = BorderStyle.None;
            pathInput.BackColor = InstallerTheme.Surface;
            pathInput.ForeColor = Color.White;
            pathInput.Font = new Font("Segoe UI", 10f);
            pathInput.Text = directory;
            pathInput.ReadOnly = IsUpgrade;
            pathInput.SetBounds(12, 11, pathBox.Width - 24, 20);
            pathBox.Controls.Add(pathInput);

            browse.Text = InstallerTheme.Text("Обзор…", "Browse…");
            browse.SetBounds(WindowWidth - Side - 100, 196, 100, 40);
            browse.Enabled = !IsUpgrade;
            browse.Click += delegate { BrowseForFolder(); };

            desktop.Text = InstallerTheme.Text("Ярлык на рабочем столе", "Desktop shortcut");
            desktop.SetBounds(Side, 252, WindowWidth - Side * 2, 26);
            desktop.Checked = true;
            startMenu.Text = InstallerTheme.Text("Ярлык в меню «Пуск»", "Start menu shortcut");
            startMenu.SetBounds(Side, 282, WindowWidth - Side * 2, 26);
            startMenu.Checked = true;
            if (IsUpgrade)
            {
                desktop.Visible = false;
                startMenu.Visible = false;
            }

            install.Text = IsUpgrade ? InstallerTheme.Text("Обновить", "Update") : InstallerTheme.Text("Установить", "Install");
            install.SetBounds(WindowWidth - Side - 150, WindowHeight - 72, 150, 44);
            install.Click += delegate { StartInstall(); };
            cancel.Text = InstallerTheme.Text("Отмена", "Cancel");
            cancel.SetBounds(WindowWidth - Side - 268, WindowHeight - 72, 108, 44);
            cancel.Click += delegate { Close(); };
            Controls.AddRange(new Control[] { pathBox, browse, desktop, startMenu, install, cancel });
            SetTabOrder();
        }

        private void SetTabOrder()
        {
            install.TabIndex = 0;
            cancel.TabIndex = 1;
            browse.TabIndex = 2;
        }

        private void BuildDone()
        {
            launch.Text = InstallerTheme.Text("Запустить", "Launch");
            launch.SetBounds(WindowWidth - Side - 150, WindowHeight - 72, 150, 44);
            launch.Click += delegate { LaunchAndClose(); };
            close.Text = InstallerTheme.Text("Закрыть", "Close");
            close.SetBounds(WindowWidth - Side - 268, WindowHeight - 72, 108, 44);
            close.Click += delegate { Close(); };
            Controls.AddRange(new Control[] { launch, close });
        }

        private void ShowPage(Page next)
        {
            page = next;
            bool options = next == Page.Options;
            pathBox.Visible = options;
            browse.Visible = options;
            desktop.Visible = options && !IsUpgrade;
            startMenu.Visible = options && !IsUpgrade;
            install.Visible = options;
            cancel.Visible = options;
            launch.Visible = next == Page.Done;
            close.Visible = next == Page.Done;
            if (next == Page.Progress) animation.Start();
            else animation.Stop();
            Invalidate();
        }

        private void BrowseForFolder()
        {
            using (FolderBrowserDialog dialog = new FolderBrowserDialog())
            {
                dialog.Description = InstallerTheme.Text("Папка для ComelyLauncher", "Folder for ComelyLauncher");
                dialog.SelectedPath = Directory.Exists(pathInput.Text) ? pathInput.Text : string.Empty;
                if (dialog.ShowDialog(this) == DialogResult.OK) pathInput.Text = InstallLayout.Normalize(dialog.SelectedPath);
            }
        }

        private void StartInstall()
        {
            string directory;
            try
            {
                directory = InstallLayout.Normalize(pathInput.Text);
            }
            catch (ArgumentException)
            {
                ShowInvalidPath();
                return;
            }
            catch (NotSupportedException)
            {
                ShowInvalidPath();
                return;
            }
            catch (PathTooLongException)
            {
                ShowInvalidPath();
                return;
            }
            InstallOptions options = new InstallOptions
            {
                Directory = directory,
                DesktopShortcut = desktop.Checked,
                StartMenuShortcut = startMenu.Checked,
                KeepExistingShortcuts = IsUpgrade || updateOnly
            };
            Volatile.Write(ref targetProgress, 0);
            shownProgress = 0;
            installing = true;
            ShowPage(Page.Progress);
            ThreadPool.QueueUserWorkItem(delegate { RunInstall(options); });
        }

        private void ShowInvalidPath()
        {
            ShowError(InstallerTheme.Text("Такой путь указать нельзя. Выбери другую папку.", "This path is not valid. Choose another folder."));
        }

        private void RunInstall(InstallOptions options)
        {
            try
            {
                AppInstaller.Install(options, delegate(double value) { Volatile.Write(ref targetProgress, value); });
                installedDirectory = options.Directory;
                Volatile.Write(ref targetProgress, 1);
                BeginInvoke(new Action(FinishInstall));
            }
            catch (GameRunningException)
            {
                Fail(InstallerTheme.Text("Сейчас запущена игра. Закрой Minecraft и попробуй снова.", "The game is running. Close Minecraft and try again."));
            }
            catch (ForeignFolderException error)
            {
                Fail(InstallerTheme.Text("В этой папке уже есть чужая папка app:\n", "This folder already contains a different app folder:\n") + error.Message + InstallerTheme.Text("\n\nВыбери другую папку.", "\n\nChoose another folder."));
            }
            catch (UnauthorizedAccessException)
            {
                Fail(InstallerTheme.Text("Нет прав на запись в эту папку. Выбери другую, например предложенную по умолчанию.", "No permission to write to this folder. Choose another one, such as the default."));
            }
            catch (Exception error)
            {
                Fail(InstallerTheme.Text("Не удалось установить лаунчер: ", "Could not install the launcher: ") + error.Message);
            }
        }

        private void FinishInstall()
        {
            installing = false;
            if (updateOnly)
            {
                LaunchAndClose();
                return;
            }
            ShowPage(Page.Done);
        }

        private void Fail(string message)
        {
            BeginInvoke(new Action(delegate
            {
                installing = false;
                ShowError(message);
                if (updateOnly) Close();
                else ShowPage(Page.Options);
            }));
        }

        private void ShowError(string message)
        {
            MessageBox.Show(this, message, Text, MessageBoxButtons.OK, MessageBoxIcon.Warning);
        }

        private void LaunchAndClose()
        {
            try
            {
                Program.Launch(installedDirectory);
                WaitForLauncherWindow();
            }
            catch (System.ComponentModel.Win32Exception error)
            {
                ShowError(error.Message);
            }
            Close();
        }

        private void WaitForLauncherWindow()
        {
            launch.Enabled = false;
            close.Enabled = false;
            Stopwatch waited = Stopwatch.StartNew();
            while (waited.ElapsedMilliseconds < WindowAppearTimeoutMs)
            {
                foreach (Process process in Process.GetProcessesByName("ComelyLauncher"))
                {
                    if (process.MainWindowHandle != IntPtr.Zero) return;
                }
                Application.DoEvents();
                Thread.Sleep(50);
            }
        }

#if INSTALLER_TEST
        public void SavePages(string folder)
        {
            Show();
            foreach (Page each in new[] { Page.Options, Page.Progress, Page.Done })
            {
                ShowPage(each);
                animation.Stop();
                shownProgress = 0.62;
                Application.DoEvents();
                using (Bitmap bitmap = new Bitmap(WindowWidth, WindowHeight))
                {
                    DrawToBitmap(bitmap, new Rectangle(0, 0, WindowWidth, WindowHeight));
                    bitmap.Save(Path.Combine(folder, "setup-" + each + ".png"));
                }
            }
        }
#endif
    }
}
