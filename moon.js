/* LUNARPACE moon.js — pure local moon math, zero network */
(function () {
  "use strict";

  // Synodic approximation constants
  var EPOCH_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14, 0); // 2000-01-06 18:14 UTC
  var SYNODIC = 29.530588853; // days

  function daysSinceEpoch(date) {
    return (date.getTime() - EPOCH_NEW_MOON) / 86400000;
  }

  function lunarAge(date) {
    var age = daysSinceEpoch(date) % SYNODIC;
    if (age < 0) age += SYNODIC;
    return age;
  }

  function illumination(age) {
    return (1 - Math.cos((2 * Math.PI * age) / SYNODIC)) / 2;
  }

  /* Render the moon SVG for a given date.
     We draw the lit portion as a white circle masked by a terminator:
       - waxing (age < half): lit on the right
       - waning (age > half): lit on the left
       terminator rx = r * cos(2π * age / synodic)
  */
  function renderMoon(date) {
    var age = lunarAge(date);
    var half = SYNODIC / 2;
    var r = 80, cx = 100, cy = 100;
    var angle = (2 * Math.PI * age) / SYNODIC;
    var rx = Math.abs(r * Math.cos(angle));
    var litGroup = document.getElementById("lit-group");
    if (!litGroup) return;

    var litPath;
    if (age <= half) {
      // waxing: right side lit, terminator ellipse opens right
      if (rx < 0.5) {
        // very near new moon — thin sliver, draw as narrow ellipse
        litPath = '<ellipse cx="' + (cx + r / 2) + '" cy="' + cy + '" rx="' + (r / 2) + '" ry="' + r + '" fill="#F4F6F8"/>';
      } else {
        litPath =
          '<path d="M ' + cx + ' ' + (cy - r) +
          ' A ' + r + ' ' + r + ' 0 0 1 ' + cx + ' ' + (cy + r) +
          ' A ' + rx + ' ' + r + ' 0 0 0 ' + cx + ' ' + (cy - r) +
          ' Z" fill="#F4F6F8"/>';
      }
    } else {
      // waning: left side lit
      if (rx < 0.5) {
        litPath = '<ellipse cx="' + (cx - r / 2) + '" cy="' + cy + '" rx="' + (r / 2) + '" ry="' + r + '" fill="#F4F6F8"/>';
      } else {
        litPath =
          '<path d="M ' + cx + ' ' + (cy - r) +
          ' A ' + r + ' ' + r + ' 0 0 0 ' + cx + ' ' + (cy + r) +
          ' A ' + rx + ' ' + r + ' 0 0 1 ' + cx + ' ' + (cy - r) +
          ' Z" fill="#F4F6F8"/>';
      }
    }

    // Keep the base disc + craters, replace lit shape
    litGroup.innerHTML = litPath;

    return { age: age, illumination: illumination(age) };
  }

  /* Date block: day number, weekday, month+year, lunar day */
  function renderDateBlock(date) {
    var daynum = document.getElementById("date-daynum");
    var weekday = document.getElementById("date-weekday");
    var monyear = document.getElementById("date-monyear");
    var lunar = document.getElementById("date-lunar");

    if (daynum) daynum.textContent = date.getDate();
    if (weekday) {
      weekday.textContent = date.toLocaleDateString("en-US", { weekday: "long" }).toUpperCase();
    }
    if (monyear) {
      monyear.textContent = date.toLocaleDateString("en-US", { month: "long", year: "numeric" }).toUpperCase();
    }
    if (lunar) {
      var age = lunarAge(date);
      lunar.textContent = "Lunar day " + age.toFixed(1) + " / 29.5";
    }
  }

  window.Moon = {
    lunarAge: lunarAge,
    illumination: illumination,
    renderMoon: renderMoon,
    renderDateBlock: renderDateBlock,
    SYNODIC: SYNODIC
  };
})();
