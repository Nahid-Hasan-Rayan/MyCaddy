[out:json][timeout:90];
(
  nwr["golf"]({{bbox}});
  nwr["natural"="water"]({{bbox}});
  nwr["natural"="sand"]({{bbox}});
  nwr["leisure"="golf_course"]({{bbox}});
);
out geom;
