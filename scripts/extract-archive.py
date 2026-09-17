"""Extract a bounded ZIP skill bundle, preserving ordinary Unix permissions."""

import pathlib
import stat
import sys
import unicodedata
import zipfile


def extract(archive, destination):
    root = pathlib.Path(destination).resolve()
    with zipfile.ZipFile(archive) as bundle:
        members = bundle.infolist()
        if len(members) > 10_000 or sum(m.file_size for m in members) > 200_000_000:
            raise ValueError("Archive exceeds import limits")
        seen = set()
        for member in members:
            target = (root / member.filename).resolve()
            key = unicodedata.normalize("NFC", str(target)).casefold()
            mode = member.external_attr >> 16
            if (
                not target.is_relative_to(root)
                or "\\" in member.filename
                or key in seen
                or stat.S_IFMT(mode) not in (0, stat.S_IFREG, stat.S_IFDIR)
            ):
                raise ValueError("Unsafe or duplicate archive member")
            seen.add(key)
        for member in members:
            target = root / member.filename
            if target.exists() and not (member.is_dir() and target.is_dir()):
                raise ValueError("Duplicate archive destination")
            target = pathlib.Path(bundle.extract(member, root))
            if not member.is_dir():
                target.chmod((member.external_attr >> 16) & 0o777 or 0o644)


if __name__ == "__main__":
    extract(sys.argv[1], sys.argv[2])
