import os
import re

blog_dir = r"c:\Users\Usuario\Documents\ORAN DOLAR\blog"
author_html = """
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid var(--border);">
          <div style="width: 40px; height: 40px; border-radius: 50%; background: var(--bg-surface-3); display: flex; align-items: center; justify-content: center; font-weight: bold; color: var(--gold);">CM</div>
          <div>
            <div style="font-size: 14px; font-weight: 600; color: var(--text);">Carlos Mendoza</div>
            <div style="font-size: 12px; color: var(--text-dim);">Revisión Editorial - Mayo 2026</div>
          </div>
        </div>
"""

def update_files():
    for file in os.listdir(blog_dir):
        if file.endswith(".html") and file != "index.html":
            path = os.path.join(blog_dir, file)
            with open(path, "r", encoding="utf-8") as f:
                content = f.read()
            
            # Check if it already has the author block
            if "Carlos Mendoza" in content:
                continue

            # Find </h1> and insert the author block right after
            updated = re.sub(r'(</h1>)', r'\1' + author_html, content, count=1)
            
            # Add meta author to <head>
            if '<meta name="author"' not in updated:
                updated = re.sub(r'(</title>)', r'\1\n  <meta name="author" content="Carlos Mendoza">', updated, count=1)
            
            with open(path, "w", encoding="utf-8") as f:
                f.write(updated)
            print(f"Updated {file}")

if __name__ == "__main__":
    update_files()
