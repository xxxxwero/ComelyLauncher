using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Globalization;
using System.IO;
using System.Reflection;
using System.Windows.Forms;

namespace ComelyLauncherInstaller
{
    internal static class InstallerTheme
    {
        public static readonly Color Background = Color.FromArgb(18, 12, 9);
        public static readonly Color Surface = Color.FromArgb(32, 23, 18);
        public static readonly Color Accent = Color.FromArgb(242, 92, 5);
        public static readonly Color AccentBright = Color.FromArgb(255, 122, 38);
        public static readonly Color Line = Color.FromArgb(62, 50, 44);
        public static readonly Color Muted = Color.FromArgb(178, 170, 165);

        public static bool Russian
        {
            get { return CultureInfo.CurrentUICulture.TwoLetterISOLanguageName == "ru"; }
        }

        public static string Text(string russian, string english)
        {
            return Russian ? russian : english;
        }

        public static Image LoadLogo()
        {
            using (Stream stream = Assembly.GetExecutingAssembly().GetManifestResourceStream("icon.png"))
            {
                return Image.FromStream(stream);
            }
        }

        public static GraphicsPath Rounded(RectangleF bounds, float radius)
        {
            float diameter = radius * 2;
            GraphicsPath path = new GraphicsPath();
            path.AddArc(bounds.X, bounds.Y, diameter, diameter, 180, 90);
            path.AddArc(bounds.Right - diameter, bounds.Y, diameter, diameter, 270, 90);
            path.AddArc(bounds.Right - diameter, bounds.Bottom - diameter, diameter, diameter, 0, 90);
            path.AddArc(bounds.X, bounds.Bottom - diameter, diameter, diameter, 90, 90);
            path.CloseFigure();
            return path;
        }

        public static void DrawBrand(Graphics graphics, float x, float y, float size)
        {
            using (Font font = new Font("Segoe UI", size, FontStyle.Bold))
            using (Brush white = new SolidBrush(Color.White))
            using (Brush accent = new SolidBrush(AccentBright))
            {
                const string first = "Comely";
                StringFormat format = StringFormat.GenericTypographic;
                float width = graphics.MeasureString(first, font, PointF.Empty, format).Width;
                graphics.DrawString(first, font, white, x, y, format);
                graphics.DrawString("Launcher", font, accent, x + width, y, format);
            }
        }
    }
}
