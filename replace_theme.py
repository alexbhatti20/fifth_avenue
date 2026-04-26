import os
import re

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Replacements
    content = content.replace('font-bebas', 'font-playfair')
    content = content.replace('from-primary to-orange-500', 'from-primary to-accent')
    content = content.replace('from-primary via-primary to-orange-500', 'from-primary to-accent')
    content = content.replace('from-rose-600 via-orange-500 to-amber-400', 'from-primary to-accent')
    content = content.replace('text-orange-500', 'text-accent')
    content = content.replace('bg-orange-500', 'bg-accent')
    content = content.replace('orange-500/10', 'accent/10')
    content = content.replace('orange-500/5', 'accent/5')
    content = content.replace('orange-200', 'accent/20')
    content = content.replace('from-red-50 via-orange-50 to-rose-50', 'from-background via-secondary/10 to-background')
    content = content.replace('border-red-200/60', 'border-border/50')
    content = content.replace('border-red-200/50', 'border-border/50')
    content = content.replace('bg-red-100', 'bg-destructive/10')
    content = content.replace('bg-red-200', 'bg-destructive/20')
    content = content.replace('text-red-500', 'text-destructive')
    content = content.replace('hover:bg-red-500/10', 'hover:bg-destructive/10')

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

def walk_dir(directory):
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith('.tsx') or file.endswith('.ts') or file.endswith('.css'):
                process_file(os.path.join(root, file))

if __name__ == "__main__":
    base_dir = r"e:\zoiro-broast-hub-main\fifth_avenue"
    walk_dir(os.path.join(base_dir, 'components'))
    walk_dir(os.path.join(base_dir, 'app'))
    print("Done replacing.")
