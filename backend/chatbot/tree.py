"""Decision tree for the chatbot."""

CHAT_TREE = {
    "root": {
        "text": "Welcome to Riverside Books! How can I help you today?",
        "options": [
            {"id": "check_stock", "label": "Check if a book is in stock"},
            {"id": "hours_location", "label": "Store hours & location"},
            {"id": "policies", "label": "Returns & policies"},
            {"id": "events", "label": "Upcoming events"},
            {"id": "escalate", "label": "Leave a message for staff"},
        ],
    },
    "check_stock": {
        "text": "I can check our shelves for you! Please reply with the title, author, or ISBN of the book.",
        "options": [{"id": "root", "label": "Back to main menu"}],
    },
    "hours_location": {
        # This will be resolved dynamically in service.py
        "text": "",
        "options": [{"id": "root", "label": "Back to main menu"}],
    },
    "policies": {
        "text": "Which policy would you like to know about?",
        "options": [
            {"id": "policy_returns", "label": "Returns"},
            {"id": "policy_holds", "label": "Pre-orders & Holds"},
            {"id": "policy_special", "label": "Special Orders"},
            {"id": "policy_gifts", "label": "Cards & Gifts"},
            {"id": "root", "label": "Back to main menu"},
        ],
    },
    "events": {
        # This will be resolved dynamically in service.py
        "text": "",
        "options": [{"id": "root", "label": "Back to main menu"}],
    },
    "escalate": {
        "text": "Please provide your name, phone or email, and message, and I'll pass it on to our staff.",
        "options": [{"id": "root", "label": "Cancel"}],
    },
    # Leaves for policies
    "policy_returns": {
        "text": "",  # dynamically populated
        "options": [{"id": "root", "label": "Back to main menu"}],
    },
    "policy_holds": {
        "text": "",
        "options": [{"id": "root", "label": "Back to main menu"}],
    },
    "policy_special": {
        "text": "",
        "options": [{"id": "root", "label": "Back to main menu"}],
    },
    "policy_gifts": {
        "text": "",
        "options": [{"id": "root", "label": "Back to main menu"}],
    },
}
