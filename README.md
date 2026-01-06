# Cloudbeds ID Scanner

A Chrome extension that scans identity documents (ID cards, passports, driver's licenses) and automatically fills guest forms in Cloudbeds using OpenAI's Vision API.

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-green?logo=googlechrome)
![License](https://img.shields.io/badge/License-MIT-blue)

## ✨ Features

- 📷 **Automatic scanning** - Load images from a configured folder or select them manually
- 🪪 **Spanish DNI/NIE support** - Extracts data from both sides of the document (front and back)
- 🛂 **Multiple documents** - Compatible with passports, driver's licenses, and other ID documents
- 🤖 **Advanced AI** - Uses OpenAI's GPT-5-mini for high-precision data extraction
- 📝 **Auto-fill** - Automatically fills Cloudbeds guest form fields
- � **Price Comparison** - Compare your hotel prices with competitors from Booking.com directly from the calendar
- �📊 **Papel de Cruces** - Generates Excel reports with room status (check-in, occupied, check-out)
- 🏙️ **Spanish municipalities** - Built-in database for Spanish city autocomplete
- 🌍 **Nationalities** - Multi-language nationality recognition

## 📦 Installation

### From source code

1. Clone this repository:

   ```bash
   git clone https://github.com/domindez/cloudbeds-scan.git
   ```

2. Open Chrome and go to `chrome://extensions/`

3. Enable **Developer mode** (top right corner)

4. Click **Load unpacked** and select the project folder

5. The extension will appear in your extensions bar

## ⚙️ Configuration

1. Click on the extension icon
2. Go to the **Settings** tab
3. Enter your **OpenAI API Key** (must start with `sk-`)
4. (Optional) Configure the **scanner folder** if you use a physical scanner

## 🚀 Usage

### Scanning Documents

1. Open Cloudbeds and navigate to a guest form
2. Click on **"Edit details"** for the guest
3. Open the ID Scanner extension
4. Select the document type:
   - **DNI/NIE**: Loads the last 2 scanned images (front and back)
   - **Other document**: Loads the last scanned image
5. Click **"Scan and fill"**
6. Done! The fields will be filled automatically

### Generating Papel de Cruces

1. Navigate to the Cloudbeds calendar page
2. Open the extension
3. Click on the **"Papel de Cruces"** tab
4. Select the desired date
5. Click **"📊 Generar Excel"**
6. The Excel file will download automatically with room status organized by floor

For more details about the Papel de Cruces feature, see [CRUCES_DOCUMENTATION.md](CRUCES_DOCUMENTATION.md).

### Comparing Prices with Competitors

1. Navigate to the Cloudbeds calendar page
2. Click the **"Comparar Precios"** floating button (magnifying glass icon)
3. Configure your competitor hotels in the extension settings (Ajustes tab)
4. Select check-in and check-out dates
5. Click **"Obtener Precios"**
6. View two comparison tables:
   - **Mi Hotel**: Shows your 3 cheapest room types with actual prices from the calendar
   - **Competencia**: Shows competitor prices organized by occupancy (Single, Double, Triple)

The price comparison automatically:

- Extracts real-time prices from your CloudBeds calendar for the selected date range
- Fetches competitor prices from Booking.com
- Displays the total price for multi-night stays
- Orders your rooms from cheapest to most expensive
- Shows only when you're on the calendar page

## 🔑 Requirements

- Google Chrome (version 88 or higher)
- OpenAI account with API access
- OpenAI API Key with available credits

## 💰 Costs

The extension uses the OpenAI API to process images. Approximate cost:

- **Simple document** (1 image): ~$0.0015 per scan
- **DNI/NIE** (2 images): ~$0.0017 per scan

Costs may vary depending on image size and model response.

## 🛡️ Privacy

- Images are sent directly to the OpenAI API
- No data is stored on intermediate servers
- Your API Key is saved locally in your browser
- Extracted data is only used to fill the form

## 🤝 Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📝 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## 👤 Author

**Domindez**

- GitHub: [@domindez](https://github.com/domindez)

---

⭐ If you find this project useful, consider giving it a star on GitHub.
