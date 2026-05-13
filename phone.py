#!/usr/bin/env python3
"""
duplicate_calls.py

Usage:
    python duplicate_calls.py calls.csv
    python duplicate_calls.py calls.xlsx
    python duplicate_calls.py calls.csv -o summary.xlsx
"""

import argparse
from pathlib import Path
import pandas as pd


# ----------------------------- Duration Helpers -----------------------------

def parse_duration(duration_str: str) -> int:
    """Convert time string (HH:MM:SS or MM:SS) into total seconds."""
    try:
        parts = list(map(int, duration_str.strip().split(":")))
        if len(parts) == 2:
            minutes, seconds = parts
            return minutes * 60 + seconds
        elif len(parts) == 3:
            hours, minutes, seconds = parts
            return hours * 3600 + minutes * 60 + seconds
    except Exception:
        pass
    return 0


def format_seconds(total_seconds: int) -> str:
    """Convert total seconds into HH:MM:SS or MM:SS format."""
    hours, remainder = divmod(total_seconds, 3600)
    minutes, seconds = divmod(remainder, 60)
    return f"{hours:02}:{minutes:02}:{seconds:02}" if hours else f"{minutes:02}:{seconds:02}"


# ----------------------------- File Operations -----------------------------

def read_input_file(file_path: Path) -> pd.DataFrame:
    """Load a CSV or Excel file and extract 'phone' and 'duration' columns."""
    try:
        if file_path.suffix.lower() == ".csv":
            df = pd.read_csv(file_path, encoding="ISO-8859-1")
        elif file_path.suffix.lower() in {".xls", ".xlsx"}:
            df = pd.read_excel(file_path, skiprows=2, header=None)
            df = df.rename(columns={2: "phone", 3: "duration"})
        else:
            raise ValueError(f"Unsupported file type: {file_path.suffix}")
    except FileNotFoundError:
        raise FileNotFoundError(f"File not found: {file_path}")
    except Exception as e:
        raise ValueError(f"Failed to read input file: {e}")

    df = df[["phone", "duration"]].dropna()
    df["phone"] = df["phone"].astype(str).str.strip()
    return df


def write_output_excel(df: pd.DataFrame, output_path: Path) -> None:
    """Write summary to an Excel (.xlsx) file."""
    if output_path.suffix.lower() != ".xlsx":
        raise ValueError("Output file must be .xlsx")
    df.to_excel(output_path, index=False)


# ----------------------------- Core Logic -----------------------------

def summarize_calls(df: pd.DataFrame, phone_book_path: Path = Path("phone_book.csv")) -> pd.DataFrame:
    """Summarize all phone numbers with name, call count, and total duration."""
    if not {"phone", "duration"}.issubset(df.columns):
        phone_col = next((c for c in df.columns if str(c).lower() in {"phone", "phone_number", "number"}), None)
        duration_col = next((c for c in df.columns if str(c).lower() in {"duration", "time", "call_duration"}), None)
        if not phone_col or not duration_col:
            raise ValueError("Missing 'phone' and 'duration' columns")
        df = df[[phone_col, duration_col]].rename(columns={phone_col: "phone", duration_col: "duration"})

    df["duration_seconds"] = df["duration"].astype(str).map(parse_duration)

    summary = (
        df.groupby("phone", as_index=False)
        .agg(call_count=("duration_seconds", "size"),
             total_seconds=("duration_seconds", "sum"))
    )

    summary["total_duration"] = summary["total_seconds"].map(format_seconds)
    summary.drop(columns="total_seconds", inplace=True)

    # Merge name beside phone
    if phone_book_path.exists():
        try:
            phone_book = pd.read_csv(phone_book_path, dtype=str)
            phone_book.columns = [col.strip().lower() for col in phone_book.columns]
            phone_book = phone_book.rename(columns={"phonenumber": "phone"})
            
            # Try matching with leading 0
            summary = summary.merge(phone_book[["phone", "name"]], on="phone", how="left")
            
            # For unmatched phones, try removing leading 0 from summary phones
            unmatched = summary["name"].isnull() | summary["name"].eq("")
            if unmatched.any():
                summary_stripped = summary[unmatched].copy()
                summary_stripped["phone_stripped"] = summary_stripped["phone"].str.lstrip("0")
                phone_book["phone_stripped"] = phone_book["phone"].str.lstrip("0")
                matches = summary_stripped.merge(
                    phone_book[["phone_stripped", "name"]], 
                    on="phone_stripped", 
                    how="left",
                    suffixes=("_old", "")
                )
                summary.loc[unmatched, "name"] = matches["name"].values
        except Exception as e:
            print(f"Warning: Failed to load phone_book.csv — {e}")
            summary["name"] = ""
    else:
        summary["name"] = ""

    # Reorder columns: phone, name, call_count, total_duration
    summary = summary[["phone", "name", "call_count", "total_duration"]]

    # Sort by: known names first, then unknowns, then call count descending
    summary["name_null"] = summary["name"].isnull() | summary["name"].eq("")
    summary = summary.sort_values(by=["name_null", "call_count", "total_duration"], ascending=[True, False, False])
    summary.drop(columns="name_null", inplace=True)

    # Add TOTAL row at bottom
    total_calls = summary["call_count"].sum()
    total_row = pd.DataFrame([{
        "phone": "TOTAL",
        "name": "",
        "call_count": total_calls,
        "total_duration": ""
    }])
    summary = pd.concat([summary, total_row], ignore_index=True)

    return summary


# ----------------------------- Entry Point -----------------------------

def main():
    parser = argparse.ArgumentParser(description="Summarize phone calls and include names beside numbers.")
    parser.add_argument("input", type=Path, help="Input file path (.csv or .xlsx)")
    parser.add_argument("-o", "--output", type=Path, default=Path("summary.xlsx"),
                        help="Output Excel file path (default: summary.xlsx)")
    args = parser.parse_args()

    try:
        df = read_input_file(args.input)
        summary = summarize_calls(df)
    except Exception as err:
        print(f"Error: {err}")
        return

    try:
        write_output_excel(summary, args.output)
        print(f"✅ Summary written to: {args.output.resolve()}")
    except Exception as err:
        print(f"❌ Failed to write output: {err}")


if __name__ == "__main__":
    main()
