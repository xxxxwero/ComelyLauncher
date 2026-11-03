using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Windows.Forms;

namespace ComelyLauncherInstaller
{
    internal sealed partial class InstallerForm
    {
        protected override void OnPaint(PaintEventArgs e)
        {
            Graphics graphics = e.Graphics;
            graphics.SmoothingMode = SmoothingMode.AntiAlias;
            graphics.InterpolationMode = InterpolationMode.HighQualityBicubic;
            using (Pen border = new Pen(InstallerTheme.Line)) graphics.DrawRectangle(border, 0, 0, WindowWidth - 1, WindowHeight - 1);
            DrawGlow(graphics);
            if (page == Page.Options) DrawOptions(graphics);
            else if (page == Page.Progress) DrawProgress(graphics);
            else DrawDone(graphics);
            base.OnPaint(e);
        }

        private void DrawGlow(Graphics graphics)
        {
            using (GraphicsPath path = new GraphicsPath())
            {
                path.AddEllipse(-130, -170, 460, 460);
                using (PathGradientBrush brush = new PathGradientBrush(path))
                {
                    brush.CenterColor = Color.FromArgb(70, 255, 106, 19);
                    brush.SurroundColors = new[] { Color.FromArgb(0, 255, 106, 19) };
                    graphics.FillPath(brush, path);
                }
            }
        }

        private void DrawHeader(Graphics graphics)
        {
            graphics.DrawImage(logo, Side, 34, 72, 72);
            InstallerTheme.DrawBrand(graphics, Side + 88, 42, 21f);
            DrawText(graphics, InstallerTheme.Text("Версия ", "Version ") + AppInstaller.Version, Side + 90, 80, 10f, InstallerTheme.Muted);
        }

        private void DrawOptions(Graphics graphics)
        {
            DrawHeader(graphics);
            string lead = IsUpgrade
                ? InstallerTheme.Text("Лаунчер уже установлен (версия ", "The launcher is already installed (version ") + installedVersion + InstallerTheme.Text("). Сборки и настройки останутся на месте.", "). Instances and settings stay in place.")
                : InstallerTheme.Text("Лаунчер установится только для тебя, права администратора не нужны.", "The launcher installs for you only, no administrator rights needed.");
            DrawWrapped(graphics, lead, Side, 124, WindowWidth - Side * 2, 44, 10.5f, Color.FromArgb(225, 225, 225));
            DrawText(graphics, InstallerTheme.Text("Папка установки", "Install folder"), Side, 170, 10f, InstallerTheme.Muted);
            using (Pen pen = new Pen(InstallerTheme.Line)) graphics.DrawRectangle(pen, pathBox.Left - 1, pathBox.Top - 1, pathBox.Width + 1, pathBox.Height + 1);
        }

        private void DrawProgress(Graphics graphics)
        {
            DrawHeader(graphics);
            string title = IsUpgrade || updateOnly ? InstallerTheme.Text("Обновляем лаунчер…", "Updating the launcher…") : InstallerTheme.Text("Устанавливаем лаунчер…", "Installing the launcher…");
            DrawText(graphics, title, Side, 170, 14f, Color.White);
            const int barHeight = 8;
            int barWidth = WindowWidth - Side * 2;
            const int top = 214;
            using (Brush track = new SolidBrush(Color.FromArgb(30, 255, 255, 255)))
            using (GraphicsPath path = InstallerTheme.Rounded(new RectangleF(Side, top, barWidth, barHeight), 4f))
            {
                graphics.FillPath(track, path);
            }
            float filled = Math.Max(barHeight, barWidth * (float)Math.Min(1.0, shownProgress));
            using (Brush bar = new SolidBrush(InstallerTheme.Accent))
            using (GraphicsPath path = InstallerTheme.Rounded(new RectangleF(Side, top, filled, barHeight), 4f))
            {
                graphics.FillPath(bar, path);
            }
            float shine = Side + (float)(clock.Elapsed.TotalSeconds * 0.7 % 1.0) * filled;
            float shineLeft = Math.Max(Side, shine - 22);
            float shineRight = Math.Min(Side + filled, shine + 22);
            if (shineRight - shineLeft > barHeight)
            {
                using (Brush brush = new SolidBrush(Color.FromArgb(90, 255, 255, 255)))
                using (GraphicsPath path = InstallerTheme.Rounded(new RectangleF(shineLeft, top, shineRight - shineLeft, barHeight), 4f))
                {
                    graphics.FillPath(brush, path);
                }
            }
            DrawText(graphics, ((int)(Math.Min(1.0, shownProgress) * 100)) + "%", Side, 232, 10f, InstallerTheme.Muted);
        }

        private void DrawDone(Graphics graphics)
        {
            DrawHeader(graphics);
            DrawText(graphics, IsUpgrade ? InstallerTheme.Text("Обновление завершено", "Update complete") : InstallerTheme.Text("Установка завершена", "Installation complete"), Side, 170, 14f, Color.White);
            DrawWrapped(graphics, InstallerTheme.Text("Лаунчер можно запускать. Удалить его можно в «Приложениях и возможностях» Windows, сборки и миры при этом останутся.", "The launcher is ready. You can remove it in Windows Apps & features; your instances and worlds stay."), Side, 210, WindowWidth - Side * 2, 60, 10.5f, Color.FromArgb(225, 225, 225));
        }

        private static void DrawText(Graphics graphics, string text, float x, float y, float size, Color color)
        {
            using (Font font = new Font("Segoe UI", size))
            {
                TextRenderer.DrawText(graphics, text, font, new Point((int)x, (int)y), color, TextFormatFlags.NoPadding);
            }
        }

        private static void DrawWrapped(Graphics graphics, string text, int x, int y, int width, int height, float size, Color color)
        {
            using (Font font = new Font("Segoe UI", size))
            {
                TextRenderer.DrawText(graphics, text, font, new Rectangle(x, y, width, height), color, TextFormatFlags.WordBreak | TextFormatFlags.NoPadding);
            }
        }
    }
}
