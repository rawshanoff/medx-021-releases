import os
import logging
import requests

from telegram import Update
from telegram.ext import ApplicationBuilder, ContextTypes, CommandHandler

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)

BOT_TOKEN = os.getenv("PATIENT_BOT_TOKEN", "")
BACKEND_URL = os.getenv("BACKEND_URL", "http://127.0.0.1:8000")
BOT_INTERNAL_TOKEN = os.getenv("PATIENT_BOT_INTERNAL_TOKEN", "")


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    # Expected: /start <code>
    args = context.args or []
    if not args:
        await update.message.reply_text(
            "Здравствуйте! Чтобы привязать результаты к вашему пациенту, отправьте /start <код>, который выдаст клиника."
        )
        return

    code = args[0].strip()
    chat_id = update.effective_chat.id
    username = update.effective_user.username

    if not BOT_INTERNAL_TOKEN:
        await update.message.reply_text("Ошибка конфигурации: нет BOT_INTERNAL_TOKEN.")
        return

    try:
        resp = requests.post(
            f"{BACKEND_URL}/api/files/telegram/link",
            json={"code": code, "chat_id": chat_id, "username": username},
            headers={"x-bot-token": BOT_INTERNAL_TOKEN},
            timeout=10,
        )
        if resp.status_code != 200:
            await update.message.reply_text(f"Не удалось привязать: {resp.text}")
            return

        await update.message.reply_text(
            "Готово! Теперь клиника сможет отправлять вам результаты/файлы в этот чат."
        )
    except Exception as e:
        await update.message.reply_text(f"Ошибка связи: {e}")


def main():
    if not BOT_TOKEN:
        raise SystemExit("PATIENT_BOT_TOKEN is required")

    app = ApplicationBuilder().token(BOT_TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    app.run_polling()


if __name__ == "__main__":
    main()

