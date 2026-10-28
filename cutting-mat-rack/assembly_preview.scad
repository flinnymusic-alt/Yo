// Preview only (not for printing): two brackets on a wall holding
// three 380 x 250 mm mats on their long edge.
use <mat_rack_bracket.scad>

mat_len = 380;
mat_h   = 250;
mat_t   = 1.5;
// bracket centres at ~22% in from each end of the mat
centres = [mat_len * 0.22, mat_len * 0.78];
bw = 80;   // must match `width` in mat_rack_bracket.scad
y_in = 34; // back_wall + pocket_gap

color("Gainsboro") translate([-60, -10, -40]) cube([mat_len + 120, 10, 340]);

for (c = centres)
    color("SteelBlue") translate([c - bw / 2, 0, 0]) bracket();

cols = ["Tomato", "YellowGreen", "Gold"];
for (i = [0 : 2]) {
    yb = y_in - 1 - (i + 0.5) * mat_t;
    yt = (2 - i + 0.5) * mat_t;
    zb = 4.5 + (y_in - yb) * tan(8);
    a  = atan2(yb - yt, mat_h);
    color(cols[i], 0.9)
        translate([0, yb, zb]) rotate([a, 0, 0])
            translate([0, -mat_t / 2, 0]) cube([mat_len, mat_t, mat_h]);
}
