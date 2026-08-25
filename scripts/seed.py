"""Re-runnable seed data for the Riverside Books suite (PRD §6.7).

Every timestamp is generated **relative to the moment the script runs**. That is
the whole point of the script existing: the previous checked-in JSON carried
fixed timestamps, so its live holds and upcoming events aged into the past and
silently stopped demonstrating the cases §10's walkthrough depends on.

The data is built storage-agnostically — `build_seed()` returns plain dicts
matching the §6 field names, and a writer renders them. Today the only writer
targets the JSON store; a database writer drops in beside it without touching
the data above it.

Usage:
    uv run python -m scripts.seed                 # writes ./mock_data
    uv run python -m scripts.seed --data-dir DIR
"""

from __future__ import annotations

import argparse
import json
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

ISO = "%Y-%m-%dT%H:%M:%SZ"

# A hold lives 48 hours from creation (§5.7, and store_info.policies.holds).
HOLD_WINDOW_HOURS = 48

BOOKS: list[dict[str, Any]] = [
    {
        "isbn": "9780143039433",
        "title": "The Grapes of Wrath",
        "author": "John Steinbeck",
        "format": "paperback",
        "price_cents": 1799,
        "stock_count": 0,
        "reserved_count": 0,
        "low_stock_threshold": 2,
        "genre": "Classic Literature",
        "blurb": "A portrait of the conflict between the powerful and the powerless "
        "during the Great Depression.",
        "cover_image_url": "https://covers.openlibrary.org/b/isbn/9780143039433-L.jpg",
        "publisher": "Penguin Classics",
        "published_date": "2006-03-28",
    },
    {
        "isbn": "9780374605928",
        "title": "Tomorrow, and Tomorrow, and Tomorrow",
        "author": "Gabrielle Zevin",
        "format": "hardcover",
        "price_cents": 2800,
        "stock_count": 2,
        "reserved_count": 2,
        "low_stock_threshold": 2,
        "genre": "Contemporary Fiction",
        "blurb": "Two friends—often in love, but never lovers—come together as creative "
        "partners in the world of video game design.",
        "cover_image_url": "https://covers.openlibrary.org/b/isbn/9780374605928-L.jpg",
        "publisher": "Knopf",
        "published_date": "2022-07-05",
    },
    {
        "isbn": "9780525559474",
        "title": "The Midnight Library",
        "author": "Matt Haig",
        "format": "hardcover",
        "price_cents": 2600,
        "stock_count": 10,
        "reserved_count": 0,
        "low_stock_threshold": 2,
        "genre": "Fantasy",
        "blurb": "Between life and death there is a library where every book offers a "
        "chance to try another life you could have lived.",
        "cover_image_url": "https://covers.openlibrary.org/b/isbn/9780525559474-L.jpg",
        "publisher": "Viking",
        "published_date": "2020-09-29",
    },
    {
        "isbn": "9780062315007",
        "title": "The Alchemist",
        "author": "Paulo Coelho",
        "format": "paperback",
        "price_cents": 1699,
        "stock_count": 2,
        "reserved_count": 1,
        "low_stock_threshold": 2,
        "genre": "Philosophical Fiction",
        "blurb": "A magical story of Santiago, an Andalusian shepherd boy who yearns to "
        "travel in search of a worldly treasure.",
        "cover_image_url": "https://covers.openlibrary.org/b/isbn/9780062315007-L.jpg",
        "publisher": "HarperOne",
        "published_date": "2014-04-15",
    },
    {
        "isbn": "9780735211292",
        "title": "Atomic Habits",
        "author": "James Clear",
        "format": "hardcover",
        "price_cents": 2700,
        "stock_count": 2,
        "reserved_count": 0,
        "low_stock_threshold": 2,
        "genre": "Self-Help",
        "blurb": "An easy and proven way to build good habits and break bad ones.",
        "cover_image_url": "https://covers.openlibrary.org/b/isbn/9780735211292-L.jpg",
        "publisher": "Avery",
        "published_date": "2018-10-16",
    },
    {
        "isbn": "9780385547345",
        "title": "Lessons in Chemistry",
        "author": "Bonnie Garmus",
        "format": "hardcover",
        "price_cents": 2900,
        "stock_count": 7,
        "reserved_count": 1,
        "low_stock_threshold": 2,
        "genre": "Historical Fiction",
        "blurb": "Chemist Elizabeth Zott is not your average woman, but life has a way "
        "of throwing her off course.",
        "cover_image_url": "https://covers.openlibrary.org/b/isbn/9780385547345-L.jpg",
        "publisher": "Doubleday",
        "published_date": "2022-04-05",
    },
    {
        "isbn": "9780441172719",
        "title": "Dune",
        "author": "Frank Herbert",
        "format": "paperback",
        "price_cents": 1800,
        "stock_count": 5,
        "reserved_count": 0,
        "low_stock_threshold": 2,
        "genre": "Sci-Fi",
        "blurb": "Set on the desert planet Arrakis, Dune is the story of the boy Paul "
        "Atreides.",
        "cover_image_url": "https://covers.openlibrary.org/b/isbn/9780441172719-L.jpg",
        "publisher": "Ace",
        "published_date": "1990-09-01",
    },
    {
        "isbn": "9780399590504",
        "title": "Educated",
        "author": "Tara Westover",
        "format": "hardcover",
        "price_cents": 2800,
        "stock_count": 4,
        "reserved_count": 0,
        "low_stock_threshold": 2,
        "genre": "Memoir",
        "blurb": "An unforgettable memoir about a young girl who leaves her survivalist "
        "family to earn a PhD from Cambridge.",
        "cover_image_url": "https://covers.openlibrary.org/b/isbn/9780399590504-L.jpg",
        "publisher": "Random House",
        "published_date": "2018-02-20",
    },
    {
        "isbn": "9780593318171",
        "title": "Klara and the Sun",
        "author": "Kazuo Ishiguro",
        "format": "paperback",
        "price_cents": 1695,
        "stock_count": 3,
        "reserved_count": 0,
        "low_stock_threshold": 2,
        "genre": "Sci-Fi",
        "blurb": "A thrilling book that offers a look at our changing world through the "
        "eyes of an unforgettable narrator.",
        "cover_image_url": "https://covers.openlibrary.org/b/isbn/9780593318171-L.jpg",
        "publisher": "Vintage",
        "published_date": "2022-03-01",
    },
    {
        "isbn": "9780316450867",
        "title": "The Overstory",
        "author": "Richard Powers",
        "format": "paperback",
        "price_cents": 1895,
        "stock_count": 4,
        "reserved_count": 0,
        "low_stock_threshold": 2,
        "genre": "Literary Fiction",
        "blurb": "An impassioned work of activism and resistance that is also a stunning "
        "evocation of the natural world.",
        "cover_image_url": "https://covers.openlibrary.org/b/isbn/9780316450867-L.jpg",
        "publisher": "W. W. Norton & Company",
        "published_date": "2019-04-02",
    },
    {
        "isbn": "9781250178602",
        "title": "Braiding Sweetgrass",
        "author": "Robin Wall Kimmerer",
        "format": "paperback",
        "price_cents": 2000,
        "stock_count": 8,
        "reserved_count": 0,
        "low_stock_threshold": 2,
        "genre": "Nature & Environment",
        "blurb": "Indigenous wisdom, scientific knowledge, and the teachings of plants.",
        "cover_image_url": "https://covers.openlibrary.org/b/isbn/9781250178602-L.jpg",
        "publisher": "Milkweed Editions",
        "published_date": "2015-08-11",
    },
    {
        "isbn": "9780525657743",
        "title": "Crying in H Mart",
        "author": "Michelle Zauner",
        "format": "hardcover",
        "price_cents": 2695,
        "stock_count": 5,
        "reserved_count": 1,
        "low_stock_threshold": 2,
        "genre": "Memoir",
        "blurb": "An unflinching, powerful memoir about growing up Korean American, "
        "losing her mother, and forging her own identity.",
        "cover_image_url": "https://covers.openlibrary.org/b/isbn/9780525657743-L.jpg",
        "publisher": "Knopf",
        "published_date": "2021-04-20",
    },
    {
        "isbn": "9780812988406",
        "title": "Between the World and Me",
        "author": "Ta-Nehisi Coates",
        "format": "hardcover",
        "price_cents": 2600,
        "stock_count": 4,
        "reserved_count": 0,
        "low_stock_threshold": 2,
        "genre": "Essays & Social Science",
        "blurb": "A profound work that pivots from the biggest questions about American "
        "history and ideals to the most intimate concerns.",
        "cover_image_url": "https://covers.openlibrary.org/b/isbn/9780812988406-L.jpg",
        "publisher": "One World",
        "published_date": "2015-07-14",
    },
    {
        "isbn": "9780547928227",
        "title": "The Hobbit",
        "author": "J.R.R. Tolkien",
        "format": "paperback",
        "price_cents": 1599,
        "stock_count": 6,
        "reserved_count": 0,
        "low_stock_threshold": 2,
        "genre": "Fantasy",
        "blurb": "Bilbo Baggins is a hobbit who enjoys a comfortable, unambitious life "
        "until Gandalf and a company of dwarves arrive.",
        "cover_image_url": "https://covers.openlibrary.org/b/isbn/9780547928227-L.jpg",
        "publisher": "Mariner Books",
        "published_date": "2012-09-18",
    },
    {
        "isbn": "9780307277671",
        "title": "The Road",
        "author": "Cormac McCarthy",
        "format": "paperback",
        "price_cents": 1600,
        "stock_count": 3,
        "reserved_count": 0,
        "low_stock_threshold": 2,
        "genre": "Post-Apocalyptic",
        "blurb": "A father and his son walk alone through burned America, heading slowly "
        "toward the coast.",
        "cover_image_url": "https://covers.openlibrary.org/b/isbn/9780307277671-L.jpg",
        "publisher": "Vintage",
        "published_date": "2007-05-01",
    },
    {
        "isbn": "9780060935467",
        "title": "To Kill a Mockingbird",
        "author": "Harper Lee",
        "format": "paperback",
        "price_cents": 1599,
        "stock_count": 9,
        "reserved_count": 0,
        "low_stock_threshold": 2,
        "genre": "Classic Literature",
        "blurb": "The unforgettable novel of a childhood in a sleepy Southern town and "
        "the crisis of conscience that rocked it.",
        "cover_image_url": "https://covers.openlibrary.org/b/isbn/9780060935467-L.jpg",
        "publisher": "Harper Perennial",
        "published_date": "2002-09-03",
    },
    {
        "isbn": "9781501110368",
        "title": "It Ends with Us",
        "author": "Colleen Hoover",
        "format": "paperback",
        "price_cents": 1699,
        "stock_count": 8,
        "reserved_count": 0,
        "low_stock_threshold": 2,
        "genre": "Romance",
        "blurb": "A brave and heartbreaking story that digs its claws into you and "
        "doesn't let go.",
        "cover_image_url": "https://covers.openlibrary.org/b/isbn/9781501110368-L.jpg",
        "publisher": "Atria Books",
        "published_date": "2016-08-02",
    },
    {
        "isbn": "9780385545969",
        "title": "The Lincoln Highway",
        "author": "Amor Towles",
        "format": "hardcover",
        "price_cents": 3000,
        "stock_count": 4,
        "reserved_count": 0,
        "low_stock_threshold": 2,
        "genre": "Historical Fiction",
        "blurb": "In June, 1954, eighteen-year-old Emmett Watson is driven home to "
        "Nebraska by the warden of the work farm.",
        "cover_image_url": "https://covers.openlibrary.org/b/isbn/9780385545969-L.jpg",
        "publisher": "Viking",
        "published_date": "2021-10-05",
    },
    {
        "isbn": "9781984801258",
        "title": "Daisy Jones & The Six",
        "author": "Taylor Jenkins Reid",
        "format": "paperback",
        "price_cents": 1700,
        "stock_count": 5,
        "reserved_count": 0,
        "low_stock_threshold": 2,
        "genre": "Contemporary Fiction",
        "blurb": "A gripping novel about the whirlwind rise of an iconic 1970s rock "
        "group and their beautiful lead singer.",
        "cover_image_url": "https://covers.openlibrary.org/b/isbn/9781984801258-L.jpg",
        "publisher": "Ballantine Books",
        "published_date": "2020-02-04",
    },
    {
        "isbn": "9780525559498",
        "title": "Sea of Tranquility",
        "author": "Emily St. John Mandel",
        "format": "hardcover",
        "price_cents": 2500,
        "stock_count": 3,
        "reserved_count": 0,
        "low_stock_threshold": 2,
        "genre": "Sci-Fi",
        "blurb": "A novel of art, time travel, love, and plague that takes the reader "
        "from Vancouver Island to a dark colony on the moon.",
        "cover_image_url": "https://covers.openlibrary.org/b/isbn/9780525559498-L.jpg",
        "publisher": "Knopf",
        "published_date": "2022-04-05",
    },
    {
        "isbn": "9780807083109",
        "title": "Kindred",
        "author": "Octavia E. Butler",
        "format": "paperback",
        "price_cents": 1695,
        "stock_count": 4,
        "reserved_count": 0,
        "low_stock_threshold": 2,
        "genre": "Sci-Fi",
        "blurb": "Dana, a modern black woman, is celebrating her twenty-sixth birthday "
        "when she is abruptly snatched from her home.",
        "cover_image_url": "https://covers.openlibrary.org/b/isbn/9780807083109-L.jpg",
        "publisher": "Beacon Press",
        "published_date": "2003-02-01",
    },
    {
        "isbn": "9780143127741",
        "title": "The Argonauts",
        "author": "Maggie Nelson",
        "format": "paperback",
        "price_cents": 1600,
        "stock_count": 2,
        "reserved_count": 0,
        "low_stock_threshold": 3,
        "genre": "Memoir & Essays",
        "blurb": "A genre-bending memoir, a work of autotheory offering fresh, fierce "
        "reflections on desire and identity.",
        "cover_image_url": "https://covers.openlibrary.org/b/isbn/9780143127741-L.jpg",
        "publisher": "Graywolf Press",
        "published_date": "2016-05-03",
    },
    {
        "isbn": "9780307743657",
        "title": "The Shining",
        "author": "Stephen King",
        "format": "paperback",
        "price_cents": 1800,
        "stock_count": 6,
        "reserved_count": 0,
        "low_stock_threshold": 2,
        "genre": "Horror",
        "blurb": "Jack Torrance's new job at the Overlook Hotel is the perfect chance "
        "for a fresh start.",
        "cover_image_url": "https://covers.openlibrary.org/b/isbn/9780307743657-L.jpg",
        "publisher": "Anchor",
        "published_date": "2012-06-26",
    },
    {
        "isbn": "9780316017930",
        "title": "The God of Small Things",
        "author": "Arundhati Roy",
        "format": "paperback",
        "price_cents": 1700,
        "stock_count": 3,
        "reserved_count": 0,
        "low_stock_threshold": 2,
        "genre": "Literary Fiction",
        "blurb": "The story of two twins, Esthappen and Rahel, in Kerala, India, "
        "navigating family, tragedy, and love.",
        "cover_image_url": "https://covers.openlibrary.org/b/isbn/9780316017930-L.jpg",
        "publisher": "Random House",
        "published_date": "2008-12-16",
    },
    {
        "isbn": "9781594634024",
        "title": "The Sympathizer",
        "author": "Viet Thanh Nguyen",
        "format": "paperback",
        "price_cents": 1700,
        "stock_count": 4,
        "reserved_count": 0,
        "low_stock_threshold": 2,
        "genre": "Historical Fiction",
        "blurb": "A story of a South Vietnamese army captain who arrives in America "
        "after the fall of Saigon, spying for the communists.",
        "cover_image_url": "https://covers.openlibrary.org/b/isbn/9781594634024-L.jpg",
        "publisher": "Grove Press",
        "published_date": "2016-04-05",
    },
    {
        "isbn": "9780345391803",
        "title": "The Hitchhiker's Guide to the Galaxy",
        "author": "Douglas Adams",
        "format": "paperback",
        "price_cents": 1599,
        "stock_count": 7,
        "reserved_count": 0,
        "low_stock_threshold": 2,
        "genre": "Sci-Fi",
        "blurb": "Seconds before the Earth is demolished to make way for a galactic "
        "freeway, Arthur Dent is plucked into space.",
        "cover_image_url": "https://covers.openlibrary.org/b/isbn/9780345391803-L.jpg",
        "publisher": "Del Rey",
        "published_date": "1995-09-27",
    },
    {
        "isbn": "9780812993547",
        "title": "Lincoln in the Bardo",
        "author": "George Saunders",
        "format": "hardcover",
        "price_cents": 2800,
        "stock_count": 3,
        "reserved_count": 0,
        "low_stock_threshold": 2,
        "genre": "Historical Fiction",
        "blurb": "An unforgettable story of familial love and loss that breaks out of "
        "its realistic, historical framework.",
        "cover_image_url": "https://covers.openlibrary.org/b/isbn/9780812993547-L.jpg",
        "publisher": "Random House",
        "published_date": "2017-02-14",
    },
    {
        "isbn": "9780143128540",
        "title": "Pachinko",
        "author": "Min Jin Lee",
        "format": "paperback",
        "price_cents": 1800,
        "stock_count": 5,
        "reserved_count": 0,
        "low_stock_threshold": 2,
        "genre": "Historical Fiction",
        "blurb": "An epic saga chronicling four generations of an ethnic Korean family "
        "in Japan.",
        "cover_image_url": "https://covers.openlibrary.org/b/isbn/9780143128540-L.jpg",
        "publisher": "Grand Central Publishing",
        "published_date": "2017-11-14",
    },
    {
        "isbn": "9780393609394",
        "title": "Astrophysics for People in a Hurry",
        "author": "Neil deGrasse Tyson",
        "format": "hardcover",
        "price_cents": 1895,
        "stock_count": 4,
        "reserved_count": 0,
        "low_stock_threshold": 2,
        "genre": "Science",
        "blurb": "What is the nature of space and time? How do we fit within the "
        "universe? Neil deGrasse Tyson brings the universe down to Earth.",
        "cover_image_url": "https://covers.openlibrary.org/b/isbn/9780393609394-L.jpg",
        "publisher": "W. W. Norton & Company",
        "published_date": "2017-05-02",
    },
    {
        "isbn": "9780140449136",
        "title": "Crime and Punishment",
        "author": "Fyodor Dostoevsky",
        "format": "paperback",
        "price_cents": 1500,
        "stock_count": 5,
        "reserved_count": 0,
        "low_stock_threshold": 2,
        "genre": "Classic Literature",
        "blurb": "Raskolnikov, an impoverished student living in St. Petersburg, decides "
        "to commit a crime to test his theory.",
        "cover_image_url": "https://covers.openlibrary.org/b/isbn/9780140449136-L.jpg",
        "publisher": "Penguin Classics",
        "published_date": "2003-01-30",
    },
    {
        "isbn": "9780593448885",
        "title": "Demon Copperhead",
        "author": "Barbara Kingsolver",
        "format": "hardcover",
        "price_cents": 3250,
        "stock_count": 6,
        "reserved_count": 1,
        "low_stock_threshold": 2,
        "genre": "Contemporary Fiction",
        "blurb": "A reimagining of David Copperfield set in the mountains of southern "
        "Appalachia.",
        "cover_image_url": "https://covers.openlibrary.org/b/isbn/9780593448885-L.jpg",
        "publisher": "Harper",
        "published_date": "2022-10-18",
    },
    {
        "isbn": "9781611808605",
        "title": "Devotions: The Selected Poems of Mary Oliver",
        "author": "Mary Oliver",
        "format": "paperback",
        "price_cents": 2200,
        "stock_count": 4,
        "reserved_count": 0,
        "low_stock_threshold": 2,
        "genre": "Poetry",
        "blurb": "",
        "cover_image_url": "https://covers.openlibrary.org/b/isbn/9781611808605-L.jpg",
        "publisher": "Penguin Books",
        "published_date": "2020-11-10",
    },
]

CUSTOMERS: list[dict[str, Any]] = [
    {
        "customer_id": "cust_001",
        "phone": "5551000001",
        "name": "Alice Walker",
        "email": "alice.walker@example.com",
        "stamps": 0,
        "rewards_available": 0,
        "joined_days_ago": 24,
    },
    {
        "customer_id": "cust_002",
        "phone": "5551000002",
        "name": "Ben Martinez",
        "email": "ben.martinez@example.com",
        "stamps": 3,
        "rewards_available": 0,
        "joined_days_ago": 71,
    },
    {
        "customer_id": "cust_003",
        "phone": "5551000003",
        "name": "Clara Oswald",
        "email": "clara.oswald@example.com",
        "stamps": 5,
        "rewards_available": 0,
        "joined_days_ago": 97,
    },
    {
        "customer_id": "cust_004",
        "phone": "5551000004",
        "name": "David Kim",
        "email": "david.kim@example.com",
        "stamps": 7,
        "rewards_available": 0,
        "joined_days_ago": 168,
    },
    {
        "customer_id": "cust_005",
        "phone": "5551000005",
        "name": "Elena Rostova",
        "email": "elena.rostova@example.com",
        "stamps": 9,
        "rewards_available": 0,
        "joined_days_ago": 192,
    },
    {
        "customer_id": "cust_006",
        "phone": "5551000006",
        "name": "Franklin Wright",
        "email": "franklin.wright@example.com",
        "stamps": 2,
        "rewards_available": 1,
        "joined_days_ago": 232,
    },
    {
        "customer_id": "cust_007",
        "phone": "5551000007",
        "name": "Grace Hopper",
        "email": "grace.hopper@example.com",
        "stamps": 0,
        "rewards_available": 2,
        "joined_days_ago": 286,
    },
    {
        "customer_id": "cust_008",
        "phone": "5551000008",
        "name": "Henry Zhao",
        "email": "",
        "stamps": 4,
        "rewards_available": 0,
        "joined_days_ago": 34,
    },
    {
        "customer_id": "cust_009",
        "phone": "5551000009",
        "name": "Ivy Chen",
        "email": "ivy.chen@example.com",
        "stamps": 1,
        "rewards_available": 0,
        "joined_days_ago": 15,
    },
    {
        "customer_id": "cust_010",
        "phone": "5551000010",
        "name": "James Sterling",
        "email": "james.sterling@example.com",
        "stamps": 8,
        "rewards_available": 0,
        "joined_days_ago": 145,
    },
]

EVENTS: list[dict[str, Any]] = [
    {
        "event_id": "event_001",
        "title": "An Evening with Zadie Smith: Modern Fiction & Belonging",
        "author_name": "Zadie Smith",
        "capacity": 45,
        "tickets_sold": 45,
        "description": "Join acclaimed novelist Zadie Smith for an intimate reading and "
        "discussion on contemporary fiction, identity, and the craft of "
        "storytelling.",
        "starts_in_hours": 451,
    },
    {
        "event_id": "event_002",
        "title": "Poetry Workshop & Open Mic Night",
        "author_name": "Ada Limón",
        "capacity": 30,
        "tickets_sold": 18,
        "description": "A guided generative poetry workshop led by U.S. Poet Laureate "
        "Ada Limón, followed by community open mic readings.",
        "starts_in_hours": 594,
    },
    {
        "event_id": "event_003",
        "title": "Local History: The Hudson River Valley in Print",
        "author_name": "David McCullough Jr.",
        "capacity": 40,
        "tickets_sold": 22,
        "description": "An illustrated lecture exploring the architectural, literary, "
        "and environmental heritage of the Hudson River Valley.",
        "starts_in_hours": 761,
    },
    {
        "event_id": "event_004",
        "title": "Riverside Monthly Book Club: Tomorrow, and Tomorrow, and Tomorrow",
        "author_name": "Gabrielle Zevin",
        "capacity": 25,
        "tickets_sold": 14,
        "description": "Our community book club meets to discuss Gabrielle Zevin's "
        "bestselling novel about friendship, play, and creative "
        "collaboration.",
        "starts_in_hours": 930,
    },
    {
        "event_id": "event_005",
        "title": "Children's Story Hour & Illustrator Showcase",
        "author_name": "Oliver Jeffers",
        "capacity": 35,
        "tickets_sold": 10,
        "description": "A family-friendly morning of live drawing, story reading, and "
        "interactive activities with picture book author Oliver Jeffers.",
        "starts_in_hours": 1114,
    },
]

MESSAGES: list[dict[str, Any]] = [
    {
        "message_id": "msg_001",
        "name": "Sarah Jenkins",
        "contact": "sarah.jenkins@example.com",
        "body": "Hi, I was looking for a signed copy of the new Zadie Smith book. Will "
        "signed editions be available at the event or for purchase beforehand?",
        "status": "new",
        "created_hours_ago": 9,
    },
    {
        "message_id": "msg_002",
        "name": "Marcus Vance",
        "contact": "5551234567",
        "body": "Hello! Can I order a bulk set of 15 copies of 'The Alchemist' for our "
        "community youth reading group next month?",
        "status": "new",
        "created_hours_ago": 12,
    },
    {
        "message_id": "msg_003",
        "name": "Diane Nguyen",
        "contact": "diane.n@example.com",
        "body": "Do you have any recommendations for historical fiction set in the "
        "1920s? Looking for a birthday gift for my mother.",
        "status": "read",
        "created_hours_ago": 32,
    },
]

ORDERS: list[dict[str, Any]] = [
    {
        "order_id": "order_001",
        "customer_id": "cust_001",
        "items": [{"isbn": "9780374605928", "quantity": 1}],
        "status": "pending",
        "expires_in_hours": 42,
        "notes": "Please hold at front desk",
    },
    {
        "order_id": "order_002",
        "customer_id": "cust_002",
        "items": [{"isbn": "9780374605928", "quantity": 1}],
        "status": "ready_for_pickup",
        "expires_in_hours": 38,
        "notes": "Will pick up around 5pm",
    },
    {
        "order_id": "order_003",
        "customer_id": "cust_003",
        "items": [{"isbn": "9780062315007", "quantity": 1}],
        "status": "pending",
        # Lapsed but not yet swept — the row §5.7's lazy expiry runs against.
        "expires_in_hours": -6,
        "notes": "",
    },
    {
        "order_id": "order_004",
        "customer_id": "cust_004",
        "items": [{"isbn": "9780385547345", "quantity": 1}],
        "status": "ready_for_pickup",
        "expires_in_hours": 36,
        "notes": "Calling when in parking lot",
    },
    {
        "order_id": "order_005",
        "customer_id": "cust_005",
        "items": [{"isbn": "9780525657743", "quantity": 1}],
        "status": "pending",
        "expires_in_hours": 43,
        "notes": "Gift for a friend",
    },
    {
        "order_id": "order_006",
        "customer_id": "cust_006",
        "items": [{"isbn": "9780593448885", "quantity": 1}],
        "status": "ready_for_pickup",
        "expires_in_hours": 35,
        "notes": "",
    },
    {
        "order_id": "order_007",
        "customer_id": "cust_007",
        "items": [{"isbn": "9780143039433", "quantity": 1}],
        "status": "expired",
        "expires_in_hours": -39,
        "notes": "Hold for weekend pickup",
    },
    {
        "order_id": "order_008",
        "customer_id": "cust_008",
        "items": [{"isbn": "9780441172719", "quantity": 1}],
        "status": "completed",
        "expires_in_hours": -62,
        "notes": "Picked up Thursday",
    },
    {
        "order_id": "order_009",
        "customer_id": "cust_009",
        "items": [
            {"isbn": "9780399590504", "quantity": 1},
            {"isbn": "9780547928227", "quantity": 1},
        ],
        "status": "completed",
        "expires_in_hours": -106,
        "notes": "",
    },
    {
        "order_id": "order_010",
        "customer_id": "cust_010",
        "items": [{"isbn": "9780060935467", "quantity": 1}],
        "status": "cancelled",
        "expires_in_hours": -13,
        "notes": "Customer called to cancel",
    },
    {
        "order_id": "order_011",
        "customer_id": "cust_002",
        "items": [{"isbn": "9780307277671", "quantity": 1}],
        "status": "expired",
        "expires_in_hours": -182,
        "notes": "Hold expired after 48h",
    },
    {
        "order_id": "order_012",
        "customer_id": "cust_005",
        "items": [{"isbn": "9781501110368", "quantity": 2}],
        "status": "completed",
        "expires_in_hours": 9,
        "notes": "Collected at counter",
    },
]

STORE_INFO: dict[str, Any] = {
    "name": "Riverside Books",
    "address": "128 Main Street, Beacon, NY 12508",
    "phone": "555-0142",
    "email": "hello@riversidebooks.com",
    "hours": {
        "monday": None,
        "tuesday": {"open": "10:00", "close": "18:00"},
        "wednesday": {"open": "10:00", "close": "18:00"},
        "thursday": {"open": "10:00", "close": "18:00"},
        "friday": {"open": "10:00", "close": "20:00"},
        "saturday": {"open": "10:00", "close": "19:00"},
        "sunday": {"open": "11:00", "close": "17:00"},
    },
    "policies": {
        "returns": "Books in original, unread condition may be returned "
        "within 14 days of purchase with a receipt for a full "
        "refund. Store credit or exchange is offered within 30 "
        "days.",
        "holds": "Pre-orders and reserve requests are held free of charge at "
        "the front counter for 48 hours. After 48 hours, unclaimed "
        "holds are automatically released back to inventory.",
        "special_orders": "If a title is not in stock, our booksellers can "
        "special order almost any in-print book for you at "
        "no extra charge. Special orders typically arrive "
        "within 3 to 5 business days.",
        "gifts": "We carry a curated selection of greeting cards, artisanal "
        "notebooks, bookmarks, tote bags, and literary gift items "
        "in-store. While cards and gifts cannot be reserved online, "
        "we are happy to hold items over the phone.",
    },
    "faqs": [
        {
            "id": "faq_001",
            "question": "Where can I park when visiting Riverside Books?",
            "keywords": ["parking", "park", "car", "lot", "street parking", "garage"],
            "answer": "Free street parking is available along Main Street (2-hour "
            "limit). There is also a municipal parking lot located one "
            "block behind the store on Elm Street.",
        },
        {
            "id": "faq_002",
            "question": "Do you offer digital or physical gift cards?",
            "keywords": ["gift card", "gift certificate", "voucher", "present"],
            "answer": "Yes! Physical gift cards in any denomination can be "
            "purchased at the register in-store or ordered over the phone "
            "for pickup or mailing.",
        },
        {
            "id": "faq_003",
            "question": "How does the Riverside Books loyalty program work?",
            "keywords": [
                "loyalty",
                "stamp",
                "rewards",
                "stamps",
                "points",
                "free book",
                "club",
            ],
            "answer": "For every book you purchase or collect in-store, you earn 1 "
            "stamp on your digital loyalty card. Once you collect 10 "
            "stamps, you earn 1 free book reward!",
        },
        {
            "id": "faq_004",
            "question": "Is the bookstore wheelchair accessible?",
            "keywords": [
                "accessible",
                "wheelchair",
                "ada",
                "ramp",
                "disability",
                "stroller",
            ],
            "answer": "Yes, our entrance has a ramp and our aisles are wide and "
            "fully ADA accessible. If you need any assistance reaching "
            "high shelves, our booksellers are always glad to help.",
        },
        {
            "id": "faq_005",
            "question": "Do you buy or appraise used books?",
            "keywords": [
                "used books",
                "sell books",
                "trade",
                "appraisal",
                "secondhand",
                "buyback",
            ],
            "answer": "We currently only sell new books and do not buy back or "
            "appraise used books. We recommend donating gently used books "
            "to the local Beacon Public Library.",
        },
        {
            "id": "faq_006",
            "question": "Do you offer Wi-Fi or space to read and work?",
            "keywords": [
                "wifi",
                "wi-fi",
                "internet",
                "study",
                "work",
                "seating",
                "table",
            ],
            "answer": "We have comfortable reading armchairs throughout the store. "
            "We provide complimentary high-speed guest Wi-Fi for all "
            "visitors.",
        },
    ],
}


def _stamp(now: datetime, hours: float) -> str:
    return (now + timedelta(hours=hours)).strftime(ISO)


def build_seed(now: datetime | None = None) -> dict[str, Any]:
    """Build the full seed as plain dicts, with all timestamps relative to `now`."""
    now = now or datetime.now(UTC)

    books = [dict(b) for b in BOOKS]
    price_by_isbn = {b["isbn"]: b["price_cents"] for b in books}

    customers = []
    for c in CUSTOMERS:
        c = dict(c)
        joined = now - timedelta(days=c.pop("joined_days_ago"))
        customers.append(c | {"joined_date": joined.strftime("%Y-%m-%d")})

    events = []
    for e in EVENTS:
        e = dict(e)
        events.append(e | {"starts_at": _stamp(now, e.pop("starts_in_hours"))})

    messages = []
    for m in MESSAGES:
        m = dict(m)
        messages.append(m | {"created_at": _stamp(now, -m.pop("created_hours_ago"))})

    orders = []
    for o in ORDERS:
        o = dict(o)
        expires_in = o.pop("expires_in_hours")
        total = sum(price_by_isbn[i["isbn"]] * i["quantity"] for i in o["items"])
        orders.append(
            o
            | {
                "created_at": _stamp(now, expires_in - HOLD_WINDOW_HOURS),
                "hold_expires_at": _stamp(now, expires_in),
                "total_cents": total,
            }
        )

    # Field order matching the committed files, so a regenerated seed diffs cleanly.
    order_keys = [
        "order_id",
        "customer_id",
        "items",
        "status",
        "created_at",
        "hold_expires_at",
        "total_cents",
        "notes",
    ]
    orders = [{k: o[k] for k in order_keys} for o in orders]

    return {
        "inventory.json": books,
        "customers.json": customers,
        "orders.json": orders,
        "events.json": events,
        "messages.json": messages,
        "store_info.json": STORE_INFO,
    }


def check_minimums(seed: dict[str, Any], now: datetime) -> None:
    """Assert the §6.7 seed minimums.

    A seed that cannot demonstrate the edge-case screens is a broken seed, so
    this fails loudly rather than writing files that quietly stop exercising
    them.
    """
    books = seed["inventory.json"]
    customers = seed["customers.json"]
    orders = seed["orders.json"]
    events = seed["events.json"]

    def avail(b):
        return b["stock_count"] - b["reserved_count"]

    problems = []
    if len(books) < 20:
        problems.append(f"need 20+ books, have {len(books)}")
    if sum(1 for b in books if avail(b) == 0) < 1:
        problems.append("need at least one book with available_count == 0")
    if sum(1 for b in books if 1 <= avail(b) <= b["low_stock_threshold"]) < 2:
        problems.append("need 2+ books in the low-stock band")
    if len(customers) < 8:
        problems.append(f"need 8+ customers, have {len(customers)}")
    if not any(c["stamps"] == 0 for c in customers):
        problems.append("need a customer with 0 stamps")
    if not any(c["rewards_available"] >= 1 for c in customers):
        problems.append("need a customer with rewards_available >= 1")
    if len(orders) < 10:
        problems.append(f"need 10+ orders, have {len(orders)}")

    statuses = {o["status"] for o in orders}
    missing = {
        "pending",
        "ready_for_pickup",
        "completed",
        "cancelled",
        "expired",
    } - statuses
    if missing:
        problems.append(f"orders missing statuses: {sorted(missing)}")

    stamp_now = now.strftime(ISO)
    if not any(o["hold_expires_at"] < stamp_now for o in orders):
        problems.append("need an order already past hold_expires_at")
    # The failure the fixed-timestamp seed actually suffered: no *live* hold left.
    live = [
        o
        for o in orders
        if o["status"] == "pending" and o["hold_expires_at"] > stamp_now
    ]
    if not live:
        problems.append("need at least one pending order that has NOT expired")
    # And the opposite row: a hold that has lapsed but has not yet been swept,
    # which is what §5.7's lazy expiry actually runs against.
    lapsed = [
        o
        for o in orders
        if o["status"] == "pending" and o["hold_expires_at"] < stamp_now
    ]
    if not lapsed:
        problems.append("need a pending order already past expiry, for the §5.7 sweep")

    if len(events) < 4:
        problems.append(f"need 4+ events, have {len(events)}")
    if not any(e["tickets_sold"] >= e["capacity"] for e in events):
        problems.append("need a sold-out event")
    if not all(e["starts_at"] > stamp_now for e in events):
        problems.append("every seeded event must still be upcoming")

    if problems:
        raise SystemExit("Seed does not meet PRD §6.7:\n  - " + "\n  - ".join(problems))


def write_json(seed: dict[str, Any], data_dir: Path) -> None:
    data_dir.mkdir(parents=True, exist_ok=True)
    for filename, payload in seed.items():
        path = data_dir / filename
        temp_path = path.with_suffix(".tmp")
        temp_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        temp_path.replace(path)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", default="mock_data", type=Path)
    args = parser.parse_args()

    now = datetime.now(UTC)
    seed = build_seed(now)
    check_minimums(seed, now)
    write_json(seed, args.data_dir)

    orders = seed["orders.json"]
    stamp_now = now.strftime(ISO)
    live = sum(
        1
        for o in orders
        if o["status"] == "pending" and o["hold_expires_at"] > stamp_now
    )
    print(f"Seeded {args.data_dir} at {stamp_now}")
    print(
        f"  {len(seed['inventory.json'])} books, {len(seed['customers.json'])} customers, "
        f"{len(orders)} orders ({live} live holds), {len(seed['events.json'])} events"
    )


if __name__ == "__main__":
    main()
