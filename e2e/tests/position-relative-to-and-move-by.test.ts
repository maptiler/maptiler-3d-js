import { expect, test } from "@playwright/test";
import loadFixtureAndGetMapHandle from "./helpers/loadFixtureAndGetMapHandle";

test("loads the positionRelativeToAndMoveBy fixture without errors", async ({ page }) => {
  const { mapHandle } = await loadFixtureAndGetMapHandle({
    fixture: "positionRelativeToAndMoveBy",
    page,
  });

  expect(await page.title()).toBe("MapTiler E2E Item3D setPositionRelativeTo and moveBy Test");
});

test("Item3D.setPositionRelativeTo sets position to another item when offset is zero", async ({ page }) => {
  await loadFixtureAndGetMapHandle({
    fixture: "positionRelativeToAndMoveBy",
    page,
  });

  const result = await page.evaluate(() => {
    const { itemOne, itemTwo } = window.__pageObjects as {
      itemOne: {
        lngLat: { lng: number; lat: number };
        altitude: number;
        setPositionRelativeTo: (
          item: { lngLat: { lng: number; lat: number }; altitude: number },
          offset: { x: number; y: number; z: number },
          units: "meters" | "feet" | "km" | "miles",
          cueRepaint?: boolean,
        ) => unknown;
      };
      itemTwo: { lngLat: { lng: number; lat: number }; altitude: number };
    };

    const lngBefore = itemOne.lngLat.lng;
    const latBefore = itemOne.lngLat.lat;

    itemOne.setPositionRelativeTo(itemTwo, { x: 0, y: 0, z: 0 }, "meters");
    (window as Window & { __map: { triggerRepaint: () => void } }).__map.triggerRepaint();

    return {
      lngBefore,
      latBefore,
      lngAfter: itemOne.lngLat.lng,
      latAfter: itemOne.lngLat.lat,
      altitudeAfter: itemOne.altitude,
      refLng: itemTwo.lngLat.lng,
      refLat: itemTwo.lngLat.lat,
      refAltitude: itemTwo.altitude,
    };
  });


  expect(result.lngAfter).toBeCloseTo(result.refLng, 10);
  expect(result.latAfter).toBeCloseTo(result.refLat, 10);
  expect(result.altitudeAfter).toBeCloseTo(result.refAltitude, 10);
  await expect(page).toHaveScreenshot('postion-relative-to-position-is-the-same.png');
});

test("Item3D.setPositionRelativeTo applies offset in meters (x, y, z)", async ({ page }) => {
  await loadFixtureAndGetMapHandle({
    fixture: "positionRelativeToAndMoveBy",
    page,
  });

  const result = await page.evaluate(() => {
    const { itemOne, itemTwo, EARTH_RADIUS } = window.__pageObjects as {
      EARTH_RADIUS: number;
      itemOne: {
        lngLat: { lng: number; lat: number };
        altitude: number;
        setPositionRelativeTo: (
          item: { lngLat: { lng: number; lat: number }; altitude: number },
          offset: { x: number; y: number; z: number },
          units: "meters" | "feet" | "km" | "miles",
          cueRepaint?: boolean,
        ) => unknown;
      };
      itemTwo: { lngLat: { lng: number; lat: number }; altitude: number };
    };

    const offsetX = 20;
    const offsetY = 20;
    const offsetZ = 20;
    itemOne.setPositionRelativeTo(itemTwo, { x: offsetX, y: offsetY, z: offsetZ }, "meters");
    (window as Window & { __map: { triggerRepaint: () => void } }).__map.triggerRepaint();

    const refLng = itemTwo.lngLat.lng;
    const refLat = itemTwo.lngLat.lat;
    const refAlt = itemTwo.altitude;
    const expectedLng =
      refLng +
      (offsetX / (EARTH_RADIUS * Math.cos((refLat * Math.PI) / 180))) * (180 / Math.PI);
    const expectedLat = refLat + (offsetZ / EARTH_RADIUS) * (180 / Math.PI);
    const expectedAltitude = refAlt + offsetY;

    return {
      lngAfter: itemOne.lngLat.lng,
      latAfter: itemOne.lngLat.lat,
      altitudeAfter: itemOne.altitude,
      expectedLng,
      expectedLat,
      expectedAltitude,
    };
  });
  expect(result.lngAfter).toBeCloseTo(result.expectedLng, 12);
  expect(result.latAfter).toBeCloseTo(result.expectedLat, 12);
  expect(result.altitudeAfter).toBeCloseTo(result.expectedAltitude, 10);
  await expect(page).toHaveScreenshot('postion-relative-to-position-is-offset.png');

});

test("Item3D.moveBy moves item by offset in meters (x, y, z)", async ({ page }) => {
  await loadFixtureAndGetMapHandle({
    fixture: "positionRelativeToAndMoveBy",
    page,
  });

  const result = await page.evaluate(() => {
    const { itemOne } = window.__pageObjects as {
      itemOne: {
        lngLat: { lng: number; lat: number };
        altitude: number;
        moveBy: (
          offset: { x: number; y: number; z: number },
          units?: "meters" | "feet" | "km" | "miles",
          cueRepaint?: boolean,
        ) => unknown;
      };
    };

    const lngBefore = itemOne.lngLat.lng;
    const latBefore = itemOne.lngLat.lat;
    const altBefore = itemOne.altitude;

    const offsetX = 20;
    const offsetY = 20;
    const offsetZ = 20;
    itemOne.moveBy({ x: offsetX, y: offsetY, z: offsetZ }, "meters");
    (window as Window & { __map: { triggerRepaint: () => void } }).__map.triggerRepaint();

    const EARTH_RADIUS = 6371000;
    const expectedLng =
      lngBefore +
      (offsetX / (EARTH_RADIUS * Math.cos((latBefore * Math.PI) / 180))) * (180 / Math.PI);
    const expectedLat = latBefore + (offsetZ / EARTH_RADIUS) * (180 / Math.PI);
    const expectedAltitude = altBefore + offsetY;

    return {
      lngBefore,
      latBefore,
      altBefore,
      lngAfter: itemOne.lngLat.lng,
      latAfter: itemOne.lngLat.lat,
      altitudeAfter: itemOne.altitude,
      expectedLng,
      expectedLat,
      expectedAltitude,
    };
  });

  expect(result.lngAfter).toBeCloseTo(result.expectedLng, 8);
  expect(result.latAfter).toBeCloseTo(result.expectedLat, 8);
  expect(result.altitudeAfter).toBeCloseTo(result.expectedAltitude, 10);
  await expect(page).toHaveScreenshot('move-by-offset.png');

});

test("Item3D.moveBy with only x offset updates longitude and leaves lat/altitude unchanged", async ({
  page,
}) => {
  await loadFixtureAndGetMapHandle({
    fixture: "positionRelativeToAndMoveBy",
    page,
  });

  const result = await page.evaluate(() => {
    const { itemOne } = window.__pageObjects as {
      itemOne: {
        lngLat: { lng: number; lat: number };
        altitude: number;
        moveBy: (
          offset: { x: number; y: number; z: number },
          units?: "meters" | "feet" | "km" | "miles",
          cueRepaint?: boolean,
        ) => unknown;
      };
    };

    const lngBefore = itemOne.lngLat.lng;
    const latBefore = itemOne.lngLat.lat;
    const altBefore = itemOne.altitude;

    itemOne.moveBy({ x: 50, y: 0, z: 0 }, "meters");
    (window as Window & { __map: { triggerRepaint: () => void } }).__map.triggerRepaint();

    const EARTH_RADIUS = 6371000;
    const expectedLng =
      lngBefore + (50 / (EARTH_RADIUS * Math.cos((latBefore * Math.PI) / 180))) * (180 / Math.PI);

    return {
      lngBefore,
      latBefore,
      altBefore,
      lngAfter: itemOne.lngLat.lng,
      latAfter: itemOne.lngLat.lat,
      altitudeAfter: itemOne.altitude,
      expectedLng,
    };
  });

  expect(result.lngAfter).toBeCloseTo(result.expectedLng, 8);
  expect(result.latAfter).toBeCloseTo(result.latBefore, 10);
  expect(result.altitudeAfter).toBeCloseTo(result.altBefore, 10);
  await expect(page).toHaveScreenshot('move-by-only-x-offset.png');
});

test("Item3D.moveBy accepts units feet, km, and miles", async ({ page }) => {
  await loadFixtureAndGetMapHandle({
    fixture: "positionRelativeToAndMoveBy",
    page,
  });

  const initial = await page.evaluate(() => {
    const { itemOne } = window.__pageObjects as {
      itemOne: { lngLat: { lng: number; lat: number }; altitude: number };
    };
    return {
      lng: itemOne.lngLat.lng,
      lat: itemOne.lngLat.lat,
      altitude: itemOne.altitude,
    };
  });

  function resetPosition() {
    return page.evaluate(
      (init: { lng: number; lat: number; altitude: number }) => {
        const { itemOne } = window.__pageObjects as {
          itemOne: { modify: (opts: { lngLat: [number, number]; altitude: number }) => unknown };
        };
        const map = (window as Window & { __map: { triggerRepaint: () => void } }).__map;
        itemOne.modify({ lngLat: [init.lng, init.lat], altitude: init.altitude });
        map.triggerRepaint();
      },
      initial,
    );
  }

  const resultFeet = await page.evaluate(() => {
    const { itemOne } = window.__pageObjects as {
      itemOne: {
        lngLat: { lng: number; lat: number };
        altitude: number;
        moveBy: (
          offset: { x: number; y: number; z: number },
          units?: "meters" | "feet" | "km" | "miles",
        ) => unknown;
      };
    };
    const lng = itemOne.lngLat.lng;
    const lat = itemOne.lngLat.lat;
    const alt = itemOne.altitude;
    itemOne.moveBy({ x: 100, y: 10, z: 0 }, "feet");
    (window as Window & { __map: { triggerRepaint: () => void } }).__map.triggerRepaint();
    const offsetXM = 100 * 0.3048;
    const offsetYM = 10 * 0.3048;
    const expectedLng =
      lng + (offsetXM / (6371000 * Math.cos((lat * Math.PI) / 180))) * (180 / Math.PI);
    const expectedAltitude = alt + offsetYM;
    return {
      lngAfter: itemOne.lngLat.lng,
      latAfter: itemOne.lngLat.lat,
      altitudeAfter: itemOne.altitude,
      expectedLng,
      expectedLat: lat,
      expectedAltitude,
    };
  });
  expect(resultFeet.lngAfter).toBeCloseTo(resultFeet.expectedLng, 8);
  expect(resultFeet.latAfter).toBeCloseTo(resultFeet.expectedLat, 10);
  expect(resultFeet.altitudeAfter).toBeCloseTo(resultFeet.expectedAltitude, 10);
  await resetPosition();

  const resultKm = await page.evaluate(() => {
    const { itemOne } = window.__pageObjects as {
      itemOne: {
        lngLat: { lng: number; lat: number };
        altitude: number;
        moveBy: (
          offset: { x: number; y: number; z: number },
          units?: "meters" | "feet" | "km" | "miles",
        ) => unknown;
      };
    };
    const lng = itemOne.lngLat.lng;
    const lat = itemOne.lngLat.lat;
    const alt = itemOne.altitude;
    itemOne.moveBy({ x: 0.05, y: 0.02, z: 0.01 }, "km");
    (window as Window & { __map: { triggerRepaint: () => void } }).__map.triggerRepaint();
    const offsetXM = 50;
    const offsetZM = 10;
    const offsetYM = 20;
    const expectedLng =
      lng + (offsetXM / (6371000 * Math.cos((lat * Math.PI) / 180))) * (180 / Math.PI);
    const expectedLat = lat + (offsetZM / 6371000) * (180 / Math.PI);
    const expectedAltitude = alt + offsetYM;
    return {
      lngAfter: itemOne.lngLat.lng,
      latAfter: itemOne.lngLat.lat,
      altitudeAfter: itemOne.altitude,
      expectedLng,
      expectedLat,
      expectedAltitude,
    };
  });
  expect(resultKm.lngAfter).toBeCloseTo(resultKm.expectedLng, 8);
  expect(resultKm.latAfter).toBeCloseTo(resultKm.expectedLat, 8);
  expect(resultKm.altitudeAfter).toBeCloseTo(resultKm.expectedAltitude, 10);
  await resetPosition();

  const resultMiles = await page.evaluate(() => {
    const { itemOne } = window.__pageObjects as {
      itemOne: {
        lngLat: { lng: number; lat: number };
        altitude: number;
        moveBy: (
          offset: { x: number; y: number; z: number },
          units?: "meters" | "feet" | "km" | "miles",
        ) => unknown;
      };
    };
    const lng = itemOne.lngLat.lng;
    const lat = itemOne.lngLat.lat;
    const alt = itemOne.altitude;
    itemOne.moveBy({ x: 0.01, y: 0, z: 0 }, "miles");
    (window as Window & { __map: { triggerRepaint: () => void } }).__map.triggerRepaint();
    const offsetXM = 0.01 * 1609.34;
    const expectedLng =
      lng + (offsetXM / (6371000 * Math.cos((lat * Math.PI) / 180))) * (180 / Math.PI);
    return {
      lngAfter: itemOne.lngLat.lng,
      latAfter: itemOne.lngLat.lat,
      altitudeAfter: itemOne.altitude,
      expectedLng,
      expectedLat: lat,
      expectedAltitude: alt,
    };
  });
  expect(resultMiles.lngAfter).toBeCloseTo(resultMiles.expectedLng, 8);
  expect(resultMiles.latAfter).toBeCloseTo(resultMiles.expectedLat, 10);
  expect(resultMiles.altitudeAfter).toBeCloseTo(resultMiles.expectedAltitude, 10);
});
