# Ranger background extraction attempt

Built-in imagegen, one source-preserving extraction attempt. Source/runtime unchanged. Rejected output preserved in rejected/ranger-background-extraction.png; alpha inspected before adoption.

Background extraction of the attached pixel-art ranger. Remove the entire white/light-gray checkerboard background, INCLUDING the enclosed empty area inside the bow between the wooden bow, thin bowstring, arrow and body, gaps between fingers/props and the gap between legs. Return the identical full character as a transparent RGBA PNG cutout. Preserve the character's face, brown hair, green leather clothing, brown boots, quiver, wooden longbow, thin brown bowstring and arrow exactly. Preserve all real white arrowhead highlights and costume highlights. Only background/checkerboard pixels become truly transparent, no solid fill. Do not redraw or change scale/pose, no new art, no shadow, no checkerboard pattern.

Original generated file: exec-2a36bbfe-6ead-4f35-9742-be0c73a6171c.png. Exact-mask processing, if chosen, needs separate explicit user direction instead of unbounded generation retries or broad white-pixel deletion.
