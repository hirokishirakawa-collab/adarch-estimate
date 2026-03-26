#!/usr/bin/env python3
"""
Optical flow difference between two frame sequences.
Detects animation changes by comparing motion patterns.

Usage:
  python3 optical_flow.py <before_dir> <after_dir> <output_json>

Input: directories containing sequential frame images (frame_00001.png, ...)
Output: JSON with motion difference scores per frame pair
"""

import sys
import os
import json
import numpy as np
from PIL import Image

def load_grayscale(path, size=(160, 90)):
    """Load image as grayscale numpy array"""
    img = Image.open(path).convert('L').resize(size, Image.BILINEAR)
    return np.array(img, dtype=np.float32)

def compute_flow_magnitude(frame1, frame2):
    """Simple block-matching motion estimation"""
    block_size = 8
    search_range = 4
    h, w = frame1.shape

    motion_map = np.zeros((h // block_size, w // block_size))

    for by in range(0, h - block_size, block_size):
        for bx in range(0, w - block_size, block_size):
            block = frame1[by:by+block_size, bx:bx+block_size]
            best_sad = float('inf')
            best_dx, best_dy = 0, 0

            for dy in range(-search_range, search_range + 1):
                for dx in range(-search_range, search_range + 1):
                    sy = by + dy
                    sx = bx + dx
                    if sy < 0 or sy + block_size > h or sx < 0 or sx + block_size > w:
                        continue
                    candidate = frame2[sy:sy+block_size, sx:sx+block_size]
                    sad = np.sum(np.abs(block - candidate))
                    if sad < best_sad:
                        best_sad = sad
                        best_dx, best_dy = dx, dy

            gy = by // block_size
            gx = bx // block_size
            if gy < motion_map.shape[0] and gx < motion_map.shape[1]:
                motion_map[gy, gx] = np.sqrt(best_dx**2 + best_dy**2)

    return motion_map

def main():
    if len(sys.argv) != 4:
        print("Usage: optical_flow.py <before_dir> <after_dir> <output_json>")
        sys.exit(1)

    before_dir = sys.argv[1]
    after_dir = sys.argv[2]
    output_path = sys.argv[3]

    before_frames = sorted([
        f for f in os.listdir(before_dir) if f.endswith('.png')
    ])
    after_frames = sorted([
        f for f in os.listdir(after_dir) if f.endswith('.png')
    ])

    results = []

    # Compare consecutive frame pairs' motion patterns
    max_pairs = min(len(before_frames) - 1, len(after_frames) - 1)

    for i in range(max_pairs):
        before_f1 = load_grayscale(os.path.join(before_dir, before_frames[i]))
        before_f2 = load_grayscale(os.path.join(before_dir, before_frames[i + 1]))
        after_f1 = load_grayscale(os.path.join(after_dir, after_frames[i]))
        after_f2 = load_grayscale(os.path.join(after_dir, after_frames[i + 1]))

        before_flow = compute_flow_magnitude(before_f1, before_f2)
        after_flow = compute_flow_magnitude(after_f1, after_f2)

        # Resize to match if needed
        min_h = min(before_flow.shape[0], after_flow.shape[0])
        min_w = min(before_flow.shape[1], after_flow.shape[1])
        before_flow = before_flow[:min_h, :min_w]
        after_flow = after_flow[:min_h, :min_w]

        diff = np.mean(np.abs(before_flow - after_flow))

        results.append({
            'frame_index': i,
            'timecode': float(i),  # 1fps assumption
            'motion_diff': float(diff),
            'before_motion': float(np.mean(before_flow)),
            'after_motion': float(np.mean(after_flow)),
        })

    with open(output_path, 'w') as f:
        json.dump(results, f)

    print(json.dumps({'status': 'ok', 'pairs_analyzed': len(results)}))

if __name__ == '__main__':
    main()
