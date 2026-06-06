// Package blur applies KVKK-compliant privacy masking to Street View images.
// It pixelates the bottom region of the frame (license plate area) using
// stdlib image packages only — no CGo or heavy dependencies required.
package blur

import (
	"bytes"
	"fmt"
	"image"
	"image/color"
	"image/draw"
	"image/jpeg"

	// Register JPEG decoder
	_ "image/jpeg"
)

const (
	// plateRegionFraction is the fraction of image height reserved for plate blurring.
	plateRegionFraction = 0.20
	// blockSize controls the pixelation strength; larger = more aggressive blur.
	blockSize = 16
	// outputQuality is the JPEG re-encode quality after blurring.
	outputQuality = 85
)

// Processor applies privacy-compliant blurs to raw JPEG images.
type Processor struct{}

// NewProcessor creates a new blur Processor.
func NewProcessor() *Processor {
	return &Processor{}
}

// ApplyPrivacyBlur pixelates the bottom 20% of the image to mask license plates,
// then re-encodes as JPEG. The original imageData bytes are not retained.
//
// Future enhancement: add a face-detection pass on the upper half using an ML model
// before this step to comply with full KVKK Article 6 requirements.
func (p *Processor) ApplyPrivacyBlur(imageData []byte) ([]byte, error) {
	src, _, err := image.Decode(bytes.NewReader(imageData))
	if err != nil {
		return nil, fmt.Errorf("failed to decode image for blur: %w", err)
	}

	bounds := src.Bounds()
	dst := image.NewRGBA(bounds)
	draw.Draw(dst, bounds, src, bounds.Min, draw.Src)

	// Calculate the y-coordinate where the plate region starts
	plateY := bounds.Max.Y - int(float64(bounds.Max.Y)*plateRegionFraction)
	plateRegion := image.Rect(bounds.Min.X, plateY, bounds.Max.X, bounds.Max.Y)

	pixelate(dst, plateRegion, blockSize)

	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, dst, &jpeg.Options{Quality: outputQuality}); err != nil {
		return nil, fmt.Errorf("failed to re-encode blurred image: %w", err)
	}

	return buf.Bytes(), nil
}

// pixelate replaces each blockSize×blockSize sub-region within the given bounds
// with the average color of that block, producing a mosaic/pixelation effect.
func pixelate(img *image.RGBA, region image.Rectangle, block int) {
	for y := region.Min.Y; y < region.Max.Y; y += block {
		for x := region.Min.X; x < region.Max.X; x += block {
			var rSum, gSum, bSum, aSum, count uint64

			// Accumulate pixel values within the block
			for dy := 0; dy < block && y+dy < region.Max.Y; dy++ {
				for dx := 0; dx < block && x+dx < region.Max.X; dx++ {
					r, g, b, a := img.At(x+dx, y+dy).RGBA()
					rSum += uint64(r >> 8)
					gSum += uint64(g >> 8)
					bSum += uint64(b >> 8)
					aSum += uint64(a >> 8)
					count++
				}
			}
			if count == 0 {
				continue
			}

			avg := color.RGBA{
				R: uint8(rSum / count),
				G: uint8(gSum / count),
				B: uint8(bSum / count),
				A: uint8(aSum / count),
			}

			// Fill the block with the averaged color
			for dy := 0; dy < block && y+dy < region.Max.Y; dy++ {
				for dx := 0; dx < block && x+dx < region.Max.X; dx++ {
					img.SetRGBA(x+dx, y+dy, avg)
				}
			}
		}
	}
}
