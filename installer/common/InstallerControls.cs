using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Windows.Forms;

namespace ComelyLauncherInstaller
{
    internal sealed class FlatButton : Control
    {
        private bool hovered;

        public bool Primary { get; set; }

        public FlatButton()
        {
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.UserPaint | ControlStyles.SupportsTransparentBackColor | ControlStyles.ResizeRedraw, true);
            BackColor = Color.Transparent;
            ForeColor = Color.White;
            Font = new Font("Segoe UI", 10.5f, FontStyle.Bold);
            Cursor = Cursors.Hand;
            TabStop = true;
        }

        protected override void OnMouseEnter(EventArgs e)
        {
            hovered = true;
            Invalidate();
            base.OnMouseEnter(e);
        }

        protected override void OnMouseLeave(EventArgs e)
        {
            hovered = false;
            Invalidate();
            base.OnMouseLeave(e);
        }

        protected override void OnKeyUp(KeyEventArgs e)
        {
            if (e.KeyCode == Keys.Enter || e.KeyCode == Keys.Space) OnClick(EventArgs.Empty);
            base.OnKeyUp(e);
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
            RectangleF bounds = new RectangleF(0.5f, 0.5f, Width - 1, Height - 1);
            Color fill = !Enabled ? InstallerTheme.Line : Primary ? (hovered ? InstallerTheme.AccentBright : InstallerTheme.Accent) : (hovered ? InstallerTheme.Line : InstallerTheme.Surface);
            using (GraphicsPath path = InstallerTheme.Rounded(bounds, 9f))
            using (Brush brush = new SolidBrush(fill))
            {
                e.Graphics.FillPath(brush, path);
                if (!Primary)
                {
                    using (Pen pen = new Pen(InstallerTheme.Line)) e.Graphics.DrawPath(pen, path);
                }
            }
            TextRenderer.DrawText(e.Graphics, Text, Font, ClientRectangle, Enabled ? ForeColor : InstallerTheme.Muted, TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter | TextFormatFlags.SingleLine);
        }
    }

    internal sealed class FlatCheck : Control
    {
        private bool isChecked;

        public bool Checked
        {
            get { return isChecked; }
            set { isChecked = value; Invalidate(); }
        }

        public FlatCheck()
        {
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.UserPaint | ControlStyles.SupportsTransparentBackColor | ControlStyles.ResizeRedraw, true);
            BackColor = Color.Transparent;
            ForeColor = Color.White;
            Font = new Font("Segoe UI", 10f);
            Cursor = Cursors.Hand;
            TabStop = true;
        }

        protected override void OnClick(EventArgs e)
        {
            Checked = !Checked;
            base.OnClick(e);
        }

        protected override void OnKeyUp(KeyEventArgs e)
        {
            if (e.KeyCode == Keys.Space) Checked = !Checked;
            base.OnKeyUp(e);
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
            RectangleF box = new RectangleF(0.5f, (Height - 19) / 2f, 18, 18);
            using (GraphicsPath path = InstallerTheme.Rounded(box, 5f))
            {
                using (Brush fill = new SolidBrush(isChecked ? InstallerTheme.Accent : InstallerTheme.Surface)) e.Graphics.FillPath(fill, path);
                using (Pen pen = new Pen(isChecked ? InstallerTheme.Accent : InstallerTheme.Line)) e.Graphics.DrawPath(pen, path);
            }
            if (isChecked)
            {
                using (Pen tick = new Pen(Color.White, 2.2f))
                {
                    e.Graphics.DrawLines(tick, new[] { new PointF(box.X + 4.5f, box.Y + 9.5f), new PointF(box.X + 8f, box.Y + 13f), new PointF(box.X + 14f, box.Y + 5.5f) });
                }
            }
            Rectangle text = new Rectangle(28, 0, Width - 28, Height);
            TextRenderer.DrawText(e.Graphics, Text, Font, text, ForeColor, TextFormatFlags.Left | TextFormatFlags.VerticalCenter | TextFormatFlags.WordBreak);
        }
    }
}
