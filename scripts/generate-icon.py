"""Generate packaging + runtime icons from the Flux Pomo logo."""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'resources' / 'Flux Pomo logo.webp'
BUILD = ROOT / 'build'
RESOURCES = ROOT / 'resources'

ICO_SIZES = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]


def main() -> None:
  BUILD.mkdir(parents=True, exist_ok=True)

  image = Image.open(SOURCE).convert('RGBA')

  # Square canvas — letterbox transparent if the logo is not square.
  side = max(image.size)
  canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
  offset = ((side - image.width) // 2, (side - image.height) // 2)
  canvas.paste(image, offset, image)

  png_512 = canvas.resize((512, 512), Image.Resampling.LANCZOS)
  build_png = BUILD / 'icon.png'
  resources_png = RESOURCES / 'icon.png'
  png_512.save(build_png)
  png_512.save(resources_png)

  ico_images = [canvas.resize(size, Image.Resampling.LANCZOS) for size in ICO_SIZES]
  ico_path = BUILD / 'icon.ico'
  ico_images[-1].save(ico_path, format='ICO', sizes=ICO_SIZES, append_images=ico_images[:-1])

  print(f'Wrote {build_png}')
  print(f'Wrote {resources_png}')
  print(f'Wrote {ico_path}')


if __name__ == '__main__':
  main()
