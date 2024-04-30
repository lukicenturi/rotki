from typing import NamedTuple


class CounterpartyDetails(NamedTuple):
    identifier: str
    label: str
    image: str | None = None
    icon: str | None = None
