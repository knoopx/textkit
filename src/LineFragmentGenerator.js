import Rect from './geom/Rect';
import Path from './geom/Path';

const BELOW = 1;
const INSIDE = 2;
const ABOVE = 3;

const BELOW_TO_INSIDE = BELOW << 4 | INSIDE;
const BELOW_TO_ABOVE = BELOW << 4 | ABOVE;
const INSIDE_TO_BELOW = INSIDE << 4 | BELOW;
const INSIDE_TO_ABOVE = INSIDE << 4 | ABOVE;
const ABOVE_TO_INSIDE = ABOVE << 4 | INSIDE;
const ABOVE_TO_BELOW = ABOVE << 4 | BELOW;

const LEFT = 0;
const RIGHT = 1;

export default class LineFragmentGenerator {
  generateFragments(lineRect, container) {
    let rects = this.splitLineRect(lineRect, container.polygon, 'INTERIOR');
    let exclusion = container.exclusionPolygon;

    if (exclusion) {
      let res = [];
      for (let rect of rects) {
        res.push(...this.splitLineRect(rect, exclusion, 'EXTERIOR'));
      }

      return res;
    }

    return rects;
  }

  splitLineRect(lineRect, polygon, type) {
    let minY = lineRect.y;
    let maxY = lineRect.maxY;
    let markers = [];
    let wrapState = BELOW;
    let min = Infinity;
    let max = -Infinity;

    for (let i = 0; i < polygon.contours.length; i++) {
      let contour = polygon.contours[i];
      let index = -1;
      let state = -1;
      do {
        let point = contour[++index];
        state = point.y <= minY ? BELOW : point.y >= maxY ? ABOVE : INSIDE;
      } while (state === INSIDE && index < contour.length - 1);

      if (state === INSIDE) {
        continue;
      }

      let idx = type === 'EXTERIOR' ? index : contour.length + index;
      let dir = type === 'EXTERIOR' ? 1 : -1;
      let currentPoint;

      for (let index = 0; index <= contour.length; index++, idx += dir) {
        let point = contour[idx % contour.length];

        if (index === 0) {
          currentPoint = point;
          state = point.y <= minY ? BELOW : point.y >= maxY ? ABOVE : INSIDE;
          continue;
        }

        let s = point.y <= minY ? BELOW : point.y >= maxY ? ABOVE : INSIDE;
        let x = point.x;

        if (s !== state) {
          let stateChangeType = (state << 4) | s;
          switch (stateChangeType) {
            case BELOW_TO_INSIDE: {
              // console.log('BELOW_TO_INSIDE')
              let xIntercept = xIntersection(minY, point, currentPoint);
              min = Math.min(xIntercept, x);
              max = Math.max(xIntercept, x);
              wrapState = BELOW;
              break;
            }

            case BELOW_TO_ABOVE: {
              // console.log('BELOW_TO_ABOVE')
              let x1 = xIntersection(minY, point, currentPoint);
              let x2 = xIntersection(maxY, point, currentPoint);
              markers.push({
                type: LEFT,
                position: Math.max(x1, x2)
              });
              break;
            }

            case ABOVE_TO_INSIDE: {
              // console.log('ABOVE_TO_INSIDE')
              let xIntercept = xIntersection(maxY, point, currentPoint);
              min = Math.min(xIntercept, x);
              max = Math.max(xIntercept, x);
              wrapState = ABOVE;
              break;
            }

            case ABOVE_TO_BELOW: {
              // console.log('ABOVE_TO_BELOW')
              let x1 = xIntersection(minY, point, currentPoint);
              let x2 = xIntersection(maxY, point, currentPoint);
              markers.push({
                type: RIGHT,
                position: Math.min(x1, x2)
              });
              break;
            }

            case INSIDE_TO_ABOVE: {
              // console.log('INSIDE_TO_ABOVE')
              let x1 = xIntersection(maxY, point, currentPoint);
              max = Math.max(max, x1);

              markers.push({
                type: LEFT,
                position: max
              });

              if (wrapState === ABOVE) {
                min = Math.min(min, x1);
                markers.push({
                  type: RIGHT,
                  position: min
                });
              }

              break;
            }

            case INSIDE_TO_BELOW: {
              // console.log('INSIDE_TO_BELOW')
              let x1 = xIntersection(minY, point, currentPoint);
              min = Math.min(min, x1);

              markers.push({
                type: RIGHT,
                position: min
              });

              if (wrapState === BELOW) {
                max = Math.max(max, x1);
                markers.push({
                  type: LEFT,
                  position: max
                });
              }

              break;
            }

            default:
              throw new Error('Unknown state change')
          }
          state = s;
        } else if (s === INSIDE) {
          min = Math.min(min, x);
          max = Math.max(max, x);
        }

        currentPoint = point;
      }
    }

    markers.sort((a, b) => a.position - b.position);
    // console.log(markers);

    let G = 0;
    if (type === 'INTERIOR' || markers.length > 0 && markers[0].type === LEFT) {
      G++;
    }

    // console.log(G)

    let minX = lineRect.x;
    let maxX = lineRect.maxX;
    let height = lineRect.height;
    let rects = [];

    for (let marker of markers) {
      if (marker.type === RIGHT) {
        if (G === 0) {
          let p = Math.min(maxX, marker.position);
          if (p >= minX) {
            rects.push(new Rect(minX, minY, p - minX, height));
          }
        }

        G++;
      } else {
        G--;
        if (G === 0 && marker.position > minX) {
          minX = marker.position;
        }
      }
    }

    // console.log(G, maxX, minX)
    if (G === 0 && maxX >= minX) {
      rects.push(new Rect(minX, minY, maxX - minX, height));
    }

    // console.log(rects)
    return rects;
  }
}

function xIntersection(e, t, n) {
  var r = e - n.y,
    i = t.y - n.y;
  return r / i * (t.x - n.x) + n.x
}
