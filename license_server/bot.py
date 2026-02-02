import logging
import requests
import asyncio
from io import BytesIO
from telegram import Update
from telegram import InputFile
from telegram.ext import ApplicationBuilder, ContextTypes, CommandHandler
from license_server.config import settings

# Setup Logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)

API_URL = settings.LICENSE_SERVER_URL

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await context.bot.send_message(
        chat_id=update.effective_chat.id, 
        text="👨‍💻 MedX Admin Bot\nCommands:\n/enable [clinic_id] [feature] [days]\nExample: /enable clinic1 finance 30"
    )

async def enable_feature(update: Update, context: ContextTypes.DEFAULT_TYPE):
    # Syntax: /enable clinic1 finance 365
    try:
        args = context.args
        if len(args) < 3:
            await update.message.reply_text("Usage: /enable [clinic_id] [feature] [days]")
            return

        clinic_id = args[0]
        feature = args[1]
        days = int(args[2])
        
        # Calculate Date
        from datetime import datetime, timedelta
        until_date = (datetime.now() + timedelta(days=days)).isoformat()
        
        # Call API
        payload = {
            "clinic_id": clinic_id,
            "features": {
                feature: until_date
            }
        }
        
        response = requests.post(
            f"{API_URL}/generate", 
            json=payload,
            headers={"x-admin-token": settings.ADMIN_TOKEN}
        )
        
        if response.status_code == 200:
            data = response.json()
            key = data["license_key"]
            buf = BytesIO(key.encode("utf-8"))
            buf.name = f"{clinic_id}.key"

            await update.message.reply_document(
                document=InputFile(buf),
                caption=f"✅ Key generated for {clinic_id}\nFeature: {feature}\nDays: {days}"
            )
        else:
            await update.message.reply_text(f"❌ API Error: {response.text}")

    except Exception as e:
        await update.message.reply_text(f"Error: {e}")

if __name__ == '__main__':
    if settings.BOT_TOKEN == "YOUR_TELEGRAM_BOT_TOKEN":
        print("Please set BOT_TOKEN in .env or config.py")
        exit(1)
        
    application = ApplicationBuilder().token(settings.BOT_TOKEN).build()
    
    application.add_handler(CommandHandler('start', start))
    application.add_handler(CommandHandler('enable', enable_feature))
    
    print("Bot started...")
    application.run_polling()
