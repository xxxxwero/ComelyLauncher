using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Windows.Forms;

namespace ComelyLauncherInstaller
{
    internal sealed class UninstallForm : Form
    {
        private const int WindowWidth = 520;
        private const int WindowHeight = 300;
        private const int Side = 32;

        private readonly string directory;
        private readonly FlatCheck removeData = new FlatCheck();
        private readonly FlatButton remove = new FlatButton { Primary = true };
        private readonly FlatButton cancel = new FlatButton();
        private readonly Image logo = InstallerTheme.LoadLogo();

        public UninstallForm(string directory)
        {
            this.directory = directory;
            Text = InstallerTheme.Text("Удаление ComelyLauncher", "Remove ComelyLauncher");
            FormBorderStyle = FormBorderStyle.None;
            StartPosition = FormStartPosition.CenterScreen;
#if INSTALLER_TEST
            StartPosition = FormStartPosition.Manual;
            Location = new Point(-4000, -4000);
#endif
            ClientSize = new Size(WindowWidth, WindowHeight);
            BackColor = InstallerTheme.Background;
            DoubleBuffered = true;
            KeyPreview = true;
            Icon = Icon.ExtractAssociatedIcon(System.Reflection.Assembly.GetExecutingAssembly().Location);
            removeData.Text = InstallerTheme.Text("Удалить также настройки и вход в аккаунты", "Also remove settings and account sign-ins");
            removeData.SetBounds(Side, 168, WindowWidth - Side * 2, 26);
            remove.Text = InstallerTheme.Text("Удалить", "Remove");
            remove.SetBounds(WindowWidth - Side - 130, WindowHeight - 66, 130, 42);
            remove.Click += delegate { Remove(); };
            cancel.Text = InstallerTheme.Text("Отмена", "Cancel");
            cancel.SetBounds(WindowWidth - Side - 248, WindowHeight - 66, 108, 42);
            cancel.Click += delegate { Close(); };
            Controls.AddRange(new Control[] { removeData, remove, cancel });
        }

        protected override void OnKeyDown(KeyEventArgs e)
        {
            if (e.KeyCode == Keys.Escape) Close();
            base.OnKeyDown(e);
        }

        private void Remove()
        {
            if (Uninstaller.Run(directory, removeData.Checked))
            {
                Close();
                return;
            }
            MessageBox.Show(this, InstallerTheme.Text("Сейчас запущена игра. Закрой Minecraft и попробуй снова.", "The game is running. Close Minecraft and try again."), Text, MessageBoxButtons.OK, MessageBoxIcon.Warning);
        }

#if INSTALLER_TEST
        public void SaveShot(string folder)
        {
            Show();
            Application.DoEvents();
            using (Bitmap bitmap = new Bitmap(WindowWidth, WindowHeight))
            {
                DrawToBitmap(bitmap, new Rectangle(0, 0, WindowWidth, WindowHeight));
                bitmap.Save(System.IO.Path.Combine(folder, "uninstall.png"));
            }
        }
#endif

        protected override void OnPaint(PaintEventArgs e)
        {
            Graphics graphics = e.Graphics;
            graphics.SmoothingMode = SmoothingMode.AntiAlias;
            graphics.InterpolationMode = InterpolationMode.HighQualityBicubic;
            using (Pen border = new Pen(InstallerTheme.Line)) graphics.DrawRectangle(border, 0, 0, WindowWidth - 1, WindowHeight - 1);
            graphics.DrawImage(logo, Side, 26, 52, 52);
            using (Font font = new Font("Segoe UI", 15f, FontStyle.Bold))
            {
                TextRenderer.DrawText(graphics, InstallerTheme.Text("Удалить ComelyLauncher?", "Remove ComelyLauncher?"), font, new Point(Side + 66, 38), Color.White, TextFormatFlags.NoPadding);
            }
            using (Font font = new Font("Segoe UI", 10.5f))
            {
                string text = InstallerTheme.Text("Удалятся программа и ярлыки. Папка с игрой, сборками и мирами останется на месте, её можно удалить вручную.", "The program and shortcuts will be removed. The folder with the game, instances and worlds stays; you can delete it yourself.");
                TextRenderer.DrawText(graphics, text, font, new Rectangle(Side, 100, WindowWidth - Side * 2, 56), Color.FromArgb(225, 225, 225), TextFormatFlags.WordBreak | TextFormatFlags.NoPadding);
            }
            base.OnPaint(e);
        }
    }
}
