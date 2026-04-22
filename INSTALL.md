# How to Install FluxGit on Windows

Hello! This guide will help you install FluxGit on your Windows computer.

## Step 1: Download the Installer
1. Go to the **FluxGit GitHub** page.
2. Click on **Releases** on the right side.
3. Download the latest `.msi` or `.exe` file (e.g., `FluxGit_1.0.0_x64-setup.exe`).
4. Also download the `FluxGit-Certificate.pfx` file if provided.

## Step 2: Trust the FluxGit Certificate (Important!)
Since FluxGit uses a self-signed certificate for security, you need to tell Windows to trust it before installing.

1. Right-click the `FluxGit-Certificate.pfx` file and select **Install PFX**.
2. Select **Local Machine** and click **Next**.
3. Confirm the file path and click **Next**.
4. Leave the password blank (or enter the one provided) and click **Next**.
5. Select **"Place all certificates in the following store"**.
6. Click **Browse** and select **Trusted Root Certification Authorities**.
7. Click **OK**, then **Next**, and then **Finish**.
8. You should see a message saying "The import was successful."

## Step 3: Run the Installer
1. Double-click the FluxGit installer file (`.msi` or `.exe`).
2. Follow the on-screen instructions to complete the setup.

## Troubleshooting: "Windows Protected Your PC"
If you see a blue **SmartScreen** warning saying "Windows protected your PC":
1. Click the **"More info"** link in the message.
2. Click the **"Run anyway"** button that appears.

Success! FluxGit is now installed and ready to use.
