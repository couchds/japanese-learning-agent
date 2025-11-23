#!/usr/bin/env python3
"""
Yomunami OCR Client
Authenticate and upload screenshots to resources
"""

import os
import sys
import json
import requests
from datetime import datetime
from pathlib import Path
import tkinter as tk
from tkinter import ttk, filedialog, messagebox
import threading
from io import BytesIO

# Platform-specific imports
if sys.platform == "win32":
    import pygetwindow as gw
elif sys.platform == "darwin":
    import Quartz
    from AppKit import NSWorkspace
else:  # Linux
    try:
        import subprocess
    except ImportError:
        pass

try:
    import mss
    from PIL import Image
    from pynput import keyboard
except ImportError:
    print("Installing required packages...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "mss", "pillow", "pynput", "pygetwindow", "requests"])
    import mss
    from PIL import Image
    from pynput import keyboard

# Configuration
CONFIG_FILE = Path.home() / ".yomunami-ocr-config.json"
DEFAULT_API_URL = "http://localhost:3001"


class YomunamiOCRClient:
    def __init__(self, root):
        self.root = root
        self.root.title("Yomunami OCR Client")
        self.root.geometry("700x600")
        
        # Load config
        self.config = self.load_config()
        self.api_url = self.config.get("api_url", DEFAULT_API_URL)
        self.hotkey = self.config.get("hotkey", "`")
        self.token = self.config.get("token", None)
        self.username = self.config.get("username", None)
        
        # State
        self.selected_window = None
        self.selected_resource = None
        self.resources = []
        self.hotkey_listener = None
        self.is_logged_in = False
        
        self.setup_ui()
        
        # Check if already logged in
        if self.token:
            self.verify_token()
        else:
            self.show_login_screen()
    
    def load_config(self):
        """Load configuration from file"""
        if CONFIG_FILE.exists():
            with open(CONFIG_FILE, 'r') as f:
                return json.load(f)
        return {
            "api_url": DEFAULT_API_URL,
            "hotkey": "`"
        }
    
    def save_config(self):
        """Save configuration to file"""
        config = {
            "api_url": self.api_url,
            "hotkey": self.hotkey,
            "token": self.token,
            "username": self.username
        }
        with open(CONFIG_FILE, 'w') as f:
            json.dump(config, f)
    
    def setup_ui(self):
        """Create the GUI"""
        # Main container
        self.main_frame = ttk.Frame(self.root, padding="10")
        self.main_frame.pack(fill=tk.BOTH, expand=True)
        
        # Title
        title_frame = ttk.Frame(self.main_frame)
        title_frame.pack(fill=tk.X, pady=(0, 10))
        
        ttk.Label(
            title_frame, 
            text="🎌 Yomunami OCR Client", 
            font=("Arial", 16, "bold")
        ).pack()
        
        # Login frame (hidden initially)
        self.login_frame = ttk.LabelFrame(self.main_frame, text="Login", padding="20")
        
        ttk.Label(self.login_frame, text="API URL:").grid(row=0, column=0, sticky=tk.W, pady=5)
        self.api_url_var = tk.StringVar(value=self.api_url)
        ttk.Entry(self.login_frame, textvariable=self.api_url_var, width=40).grid(row=0, column=1, pady=5)
        
        ttk.Label(self.login_frame, text="Username:").grid(row=1, column=0, sticky=tk.W, pady=5)
        self.username_var = tk.StringVar()
        ttk.Entry(self.login_frame, textvariable=self.username_var, width=40).grid(row=1, column=1, pady=5)
        
        ttk.Label(self.login_frame, text="Password:").grid(row=2, column=0, sticky=tk.W, pady=5)
        self.password_var = tk.StringVar()
        ttk.Entry(self.login_frame, textvariable=self.password_var, show="*", width=40).grid(row=2, column=1, pady=5)
        
        ttk.Button(self.login_frame, text="Login", command=self.login).grid(row=3, column=0, columnspan=2, pady=10)
        
        # Main app frame (shown after login)
        self.app_frame = ttk.Frame(self.main_frame)
        
        # User info
        self.user_info_frame = ttk.Frame(self.app_frame)
        self.user_info_frame.pack(fill=tk.X, pady=(0, 10))
        
        self.user_label = ttk.Label(self.user_info_frame, text="", foreground="green")
        self.user_label.pack(side=tk.LEFT)
        
        ttk.Button(self.user_info_frame, text="Logout", command=self.logout).pack(side=tk.RIGHT)
        
        # Resource selection
        resource_frame = ttk.LabelFrame(self.app_frame, text="Select Resource", padding="10")
        resource_frame.pack(fill=tk.X, pady=5)
        
        self.resource_var = tk.StringVar()
        self.resource_combo = ttk.Combobox(resource_frame, textvariable=self.resource_var, state='readonly', width=50)
        self.resource_combo.pack(side=tk.LEFT, padx=5)
        self.resource_combo.bind('<<ComboboxSelected>>', self.on_resource_select)
        
        ttk.Button(resource_frame, text="🔄 Refresh", command=self.load_resources).pack(side=tk.LEFT)
        
        # Hotkey config
        hotkey_frame = ttk.LabelFrame(self.app_frame, text="Hotkey", padding="10")
        hotkey_frame.pack(fill=tk.X, pady=5)
        
        ttk.Label(hotkey_frame, text="Capture key:").pack(side=tk.LEFT, padx=5)
        self.hotkey_var = tk.StringVar(value=self.hotkey)
        ttk.Entry(hotkey_frame, textvariable=self.hotkey_var, width=10).pack(side=tk.LEFT, padx=5)
        ttk.Button(hotkey_frame, text="Set", command=self.update_hotkey).pack(side=tk.LEFT)
        
        # Window selection
        window_frame = ttk.LabelFrame(self.app_frame, text="Select Window to Capture", padding="10")
        window_frame.pack(fill=tk.BOTH, expand=True, pady=5)
        
        list_frame = ttk.Frame(window_frame)
        list_frame.pack(fill=tk.BOTH, expand=True)
        
        scrollbar = ttk.Scrollbar(list_frame)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        
        self.window_listbox = tk.Listbox(list_frame, yscrollcommand=scrollbar.set, height=8)
        self.window_listbox.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.config(command=self.window_listbox.yview)
        
        self.window_listbox.bind('<<ListboxSelect>>', self.on_window_select)
        
        ttk.Button(window_frame, text="🔄 Refresh Windows", command=self.refresh_windows).pack(pady=5)
        
        # Info
        self.info_label = ttk.Label(self.app_frame, text="", foreground="blue")
        self.info_label.pack(pady=5)
        
        # Buttons
        button_frame = ttk.Frame(self.app_frame)
        button_frame.pack(fill=tk.X, pady=5)
        
        ttk.Button(button_frame, text="📸 Capture & Upload", command=self.capture_and_upload).pack(side=tk.LEFT, padx=5)
        
        # Status bar
        self.status_var = tk.StringVar(value="Ready")
        status_bar = ttk.Label(self.root, textvariable=self.status_var, relief=tk.SUNKEN, anchor=tk.W)
        status_bar.pack(side=tk.BOTTOM, fill=tk.X)
    
    def show_login_screen(self):
        """Show login screen"""
        self.app_frame.pack_forget()
        self.login_frame.pack(fill=tk.BOTH, expand=True)
    
    def show_app_screen(self):
        """Show main app screen"""
        self.login_frame.pack_forget()
        self.app_frame.pack(fill=tk.BOTH, expand=True)
        self.load_resources()
        self.refresh_windows()
        self.start_hotkey_listener()
    
    def login(self):
        """Login to Yomunami"""
        username = self.username_var.get().strip()
        password = self.password_var.get().strip()
        api_url = self.api_url_var.get().strip()
        
        if not username or not password:
            messagebox.showerror("Error", "Please enter username and password")
            return
        
        self.status_var.set("Logging in...")
        self.root.update()
        
        try:
            response = requests.post(
                f"{api_url}/api/auth/login",
                json={"login": username, "password": password},
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                self.token = data.get("token")
                self.username = username
                self.api_url = api_url
                self.is_logged_in = True
                
                self.save_config()
                
                self.user_label.config(text=f"Logged in as: {self.username}")
                self.show_app_screen()
                self.status_var.set("Logged in successfully!")
                
            else:
                error_msg = response.json().get("error", "Login failed")
                messagebox.showerror("Login Failed", error_msg)
                self.status_var.set("Login failed")
        
        except requests.exceptions.RequestException as e:
            messagebox.showerror("Connection Error", f"Could not connect to server:\n{str(e)}")
            self.status_var.set("Connection error")
    
    def verify_token(self):
        """Verify stored token is still valid"""
        try:
            response = requests.get(
                f"{self.api_url}/api/auth/me",
                headers={"Authorization": f"Bearer {self.token}"},
                timeout=5
            )
            
            if response.status_code == 200:
                self.is_logged_in = True
                self.user_label.config(text=f"Logged in as: {self.username}")
                self.show_app_screen()
            else:
                self.show_login_screen()
        
        except:
            self.show_login_screen()
    
    def logout(self):
        """Logout"""
        self.token = None
        self.username = None
        self.is_logged_in = False
        self.save_config()
        
        if self.hotkey_listener:
            self.hotkey_listener.stop()
        
        self.show_login_screen()
        self.status_var.set("Logged out")
    
    def load_resources(self):
        """Load user's resources from API"""
        if not self.token:
            return
        
        try:
            response = requests.get(
                f"{self.api_url}/api/resources",
                headers={"Authorization": f"Bearer {self.token}"},
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                self.resources = data.get("resources", [])
                
                # Update combobox
                resource_names = [f"{r['name']} ({r['type']})" for r in self.resources]
                self.resource_combo['values'] = resource_names
                
                if self.resources:
                    self.resource_combo.current(0)
                    self.selected_resource = self.resources[0]
                    self.update_info_label()
                
                self.status_var.set(f"Loaded {len(self.resources)} resources")
            else:
                messagebox.showerror("Error", "Failed to load resources")
        
        except requests.exceptions.RequestException as e:
            messagebox.showerror("Error", f"Could not load resources:\n{str(e)}")
    
    def on_resource_select(self, event):
        """Handle resource selection"""
        selection = self.resource_combo.current()
        if selection >= 0 and selection < len(self.resources):
            self.selected_resource = self.resources[selection]
            self.update_info_label()
    
    def update_info_label(self):
        """Update info label with current selections"""
        hotkey_text = f"⌨️ Hotkey: {self.hotkey}"
        resource_text = f"📚 Resource: {self.selected_resource['name']}" if self.selected_resource else ""
        window_text = f"🖥️ Window: {self.selected_window['title']}" if self.selected_window else ""
        
        info_parts = [hotkey_text]
        if resource_text:
            info_parts.append(resource_text)
        if window_text:
            info_parts.append(window_text)
        
        self.info_label.config(text=" | ".join(info_parts))
    
    def update_hotkey(self):
        """Update hotkey"""
        new_hotkey = self.hotkey_var.get().strip()
        if not new_hotkey:
            messagebox.showwarning("Invalid Hotkey", "Please enter a valid key!")
            return
        
        self.hotkey = new_hotkey
        self.save_config()
        self.update_info_label()
        
        if self.hotkey_listener:
            self.hotkey_listener.stop()
        self.start_hotkey_listener()
        
        self.status_var.set(f"Hotkey updated to: {self.hotkey}")
    
    def get_windows_list(self):
        """Get list of open windows"""
        windows = []
        
        if sys.platform == "win32":
            for window in gw.getAllWindows():
                if window.title and window.visible:
                    windows.append({"title": window.title, "window": window})
        elif sys.platform == "darwin":
            workspace = NSWorkspace.sharedWorkspace()
            running_apps = workspace.runningApplications()
            for app in running_apps:
                if app.activationPolicy() == 0:
                    windows.append({"title": app.localizedName(), "window": app})
        else:
            try:
                result = subprocess.run(['wmctrl', '-l'], capture_output=True, text=True)
                for line in result.stdout.split('\n'):
                    if line:
                        parts = line.split(None, 3)
                        if len(parts) >= 4:
                            windows.append({"title": parts[3], "window_id": parts[0]})
            except FileNotFoundError:
                pass
        
        return windows
    
    def refresh_windows(self):
        """Refresh window list"""
        self.window_listbox.delete(0, tk.END)
        self.windows = self.get_windows_list()
        
        for window in self.windows:
            self.window_listbox.insert(tk.END, window["title"])
        
        self.status_var.set(f"Found {len(self.windows)} windows")
    
    def on_window_select(self, event):
        """Handle window selection"""
        selection = self.window_listbox.curselection()
        if selection:
            index = selection[0]
            self.selected_window = self.windows[index]
            self.update_info_label()
    
    def capture_and_upload(self):
        """Capture screenshot and upload to API"""
        if not self.selected_window:
            messagebox.showwarning("No Window", "Please select a window first!")
            return
        
        if not self.selected_resource:
            messagebox.showwarning("No Resource", "Please select a resource first!")
            return
        
        try:
            self.status_var.set("📸 Capturing screenshot...")
            self.root.update()
            
            # Capture screenshot
            with mss.mss() as sct:
                if sys.platform == "win32":
                    window = self.selected_window["window"]
                    
                    # Try to get client area (excluding title bar and borders)
                    try:
                        import win32gui
                        import win32api
                        
                        # Find the window by title
                        hwnd = win32gui.FindWindow(None, window.title)
                        
                        if hwnd:
                            # Get client rectangle (excludes title bar and borders)
                            client_rect = win32gui.GetClientRect(hwnd)
                            client_point = win32gui.ClientToScreen(hwnd, (client_rect[0], client_rect[1]))
                            
                            monitor = {
                                "top": client_point[1],
                                "left": client_point[0],
                                "width": client_rect[2] - client_rect[0],
                                "height": client_rect[3] - client_rect[1]
                            }
                            print(f"Capturing client area: {monitor}")
                        else:
                            raise Exception("Window handle not found")
                    except Exception as e:
                        # Fallback to full window if anything fails
                        print(f"Could not capture client area ({e}), using full window")
                        monitor = {
                            "top": window.top,
                            "left": window.left,
                            "width": window.width,
                            "height": window.height
                        }
                else:
                    monitor = sct.monitors[1]
                
                screenshot = sct.grab(monitor)
                img = Image.frombytes("RGB", screenshot.size, screenshot.bgra, "raw", "BGRX")
            
            # Convert to bytes
            img_byte_arr = BytesIO()
            img.save(img_byte_arr, format='PNG')
            img_byte_arr.seek(0)
            
            # Upload to API
            self.status_var.set("☁️ Uploading to Yomunami...")
            self.root.update()
            
            files = {'image': ('screenshot.png', img_byte_arr, 'image/png')}
            data = {'resource_id': self.selected_resource['id']}
            
            # Create a new session to avoid thread-local storage issues
            session = requests.Session()
            response = session.post(
                f"{self.api_url}/api/resource-images",
                headers={"Authorization": f"Bearer {self.token}"},
                files=files,
                data=data,
                timeout=30
            )
            session.close()
            
            if response.status_code == 201:
                result = response.json()
                self.status_var.set(f"✅ Uploaded successfully! ID: {result['id']}")
                messagebox.showinfo("Success", f"Screenshot uploaded to:\n{self.selected_resource['name']}")
            else:
                # Try to parse JSON error, fallback to text
                try:
                    error_data = response.json()
                    error_msg = error_data.get("error", "Upload failed")
                except:
                    error_msg = f"Upload failed (Status {response.status_code}): {response.text[:200]}"
                
                print(f"Upload error: {response.status_code} - {response.text}")  # Debug print
                messagebox.showerror("Upload Failed", error_msg)
                self.status_var.set("Upload failed")
        
        except Exception as e:
            self.status_var.set(f"❌ Error: {str(e)}")
            messagebox.showerror("Error", f"Failed to capture/upload:\n{str(e)}")
    
    def start_hotkey_listener(self):
        """Start hotkey listener"""
        # Stop existing listener first
        if self.hotkey_listener:
            try:
                self.hotkey_listener.stop()
            except:
                pass
        
        def on_activate():
            self.root.after(0, self.capture_and_upload)
        
        try:
            hotkey_str = self.hotkey
            if len(hotkey_str) == 1:
                self.hotkey_listener = keyboard.GlobalHotKeys({hotkey_str: on_activate})
            else:
                self.hotkey_listener = keyboard.GlobalHotKeys({f'<{hotkey_str}>': on_activate})
            
            threading.Thread(target=self.hotkey_listener.start, daemon=True).start()
            print(f"Hotkey listener started for: {self.hotkey}")
        except Exception as e:
            print(f"Error setting up hotkey: {e}")
    
    def on_closing(self):
        """Handle window close"""
        if self.hotkey_listener:
            self.hotkey_listener.stop()
        self.root.destroy()


def main():
    root = tk.Tk()
    app = YomunamiOCRClient(root)
    root.protocol("WM_DELETE_WINDOW", app.on_closing)
    root.mainloop()


if __name__ == "__main__":
    main()

