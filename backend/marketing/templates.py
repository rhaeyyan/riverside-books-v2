"""Marketing templates for generating social media posts."""

from typing import TypedDict


class Template(TypedDict):
    """A single marketing template."""

    text: str
    idea: str
    requires_stock: bool


# Templates keyed by (subject_type, tone)
TEMPLATES: dict[tuple[str, str], list[Template]] = {
    ("book", "cozy"): [
        {
            "text": "Settle in with a cup of tea and '{title}' by {author}. {blurb} Perfect for a quiet afternoon.",
            "idea": "Photo of the book on a cozy blanket with a mug of tea.",
            "requires_stock": False,
        },
        {
            "text": "Looking for your next comfort read? We have {available_count} copies of '{title}' by {author} waiting for you! {blurb}",
            "idea": "Photo of the book tucked into a comfortable armchair.",
            "requires_stock": True,
        },
    ],
    ("book", "exciting"): [
        {
            "text": "Get ready for a thrill! '{title}' by {author} is here. {blurb} You won't be able to put it down!",
            "idea": "Action shot holding the book open.",
            "requires_stock": False,
        },
        {
            "text": "Grab it while you can! We've got {available_count} copies of the amazing '{title}' by {author} on the shelf right now. {blurb}",
            "idea": "Dynamic photo of the book being pulled from the shelf.",
            "requires_stock": True,
        },
    ],
    ("book", "urgent"): [
        {
            "text": "Don't miss out on '{title}' by {author}! {blurb} Secure your copy today.",
            "idea": "Close up photo of the book cover.",
            "requires_stock": False,
        },
        {
            "text": "Running low! Only {available_count} copies left of '{title}' by {author}. {blurb} Hurry in before they're gone!",
            "idea": "Photo of the last few copies on the shelf.",
            "requires_stock": True,
        },
    ],
    ("event", "cozy"): [
        {
            "text": "Join our community for a wonderful time: {title} with {author_name}. We'd love to see you there! {description}",
            "idea": "Photo of the event space prepared with chairs in a circle.",
            "requires_stock": False,
        },
    ],
    ("event", "exciting"): [
        {
            "text": "Mark your calendars! You won't want to miss {title} featuring {author_name}! {description}",
            "idea": "Bright graphic with the date and time.",
            "requires_stock": False,
        },
    ],
    ("event", "urgent"): [
        {
            "text": "Seats are filling up fast for {title} with {author_name}! {description} Get yours before it's too late.",
            "idea": "Photo of the event poster with 'selling fast' sticker.",
            "requires_stock": False,
        },
    ],
}

WAITLIST_TEMPLATES: dict[str, list[Template]] = {
    "cozy": [
        {
            "text": "{title} is completely sold out, but we're taking names for a waitlist in case spots open up. {description}",
            "idea": "Cozy photo of the event flyer.",
            "requires_stock": False,
        }
    ],
    "exciting": [
        {
            "text": "Wow, {title} is sold out! The excitement is real. We've opened a waitlist for any last-minute openings! {description}",
            "idea": "Graphic with a big 'SOLD OUT' stamp.",
            "requires_stock": False,
        }
    ],
    "urgent": [
        {
            "text": "{title} is officially sold out! Don't worry, join our waitlist now and we'll contact you if someone cancels! {description}",
            "idea": "Photo of the event poster.",
            "requires_stock": False,
        }
    ],
}
