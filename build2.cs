using System;
using System.IO;
using System.Diagnostics;
using System.Text;

class Program {
    static void Main() {
        // Read standalone.html
        string html = File.ReadAllText("standalone.html");
        string b64 = Convert.ToBase64String(Encoding.UTF8.GetBytes(html));
        
        // C# EXE wrapper that embeds HTML and launches browser
        string exeCode = @"
using System;
using System.IO;
using System.Diagnostics;
using System.Text;

class App {
    static void Main() {
        try {
            // Embedded base64 HTML (replace this)
            string b64 = @""" + b64 + @""";
            byte[] htmlBytes = Convert.FromBase64String(b64);
            string htmlContent = Encoding.UTF8.GetString(htmlBytes);
            
            // Create temp HTML file
            string tempDir = Path.Combine(Path.GetTempPath(), ""กรมนา"");
            Directory.CreateDirectory(tempDir);
            string tempFile = Path.Combine(tempDir, ""index.html"");
            File.WriteAllText(tempFile, htmlContent);
            
            // Try Edge first, then Chrome, then default browser
            string[] browsers = {
                @""C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"",
                @""C:\Program Files\Microsoft\Edge\Application\msedge.exe"",
                @""C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"",
                @""C:\Program Files\Google\Chrome\Application\chrome.exe""
            };
            
            bool launched = false;
            foreach (string browser in browsers) {
                if (File.Exists(browser)) {
                    ProcessStartInfo psi = new ProcessStartInfo {
                        FileName = browser,
                        Arguments = $""--app={tempFile}"",
                        UseShellExecute = false
                    };
                    Process.Start(psi);
                    launched = true;
                    break;
                }
            }
            
            if (!launched) {
                // Fall back to default browser
                Process.Start(new ProcessStartInfo {
                    FileName = tempFile,
                    UseShellExecute = true
                });
            }
        }
        catch (Exception ex) {
            Console.WriteLine(""Error: "" + ex.Message);
        }
    }
}
";
        
        File.WriteAllText("จัดเก็บตัวเลข_new.cs", exeCode);
        Console.WriteLine("✅ Created source code");
        Console.WriteLine("ต้อง compile ด้วย csc.exe");
    }
}
