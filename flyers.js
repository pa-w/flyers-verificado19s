var aig = require ('array_image_generator');
var fs = require ('fs');
var GoogleSpreadsheet = require('google-spreadsheet');
var async = require('async');
var sheet_id = '1C04I22tyLEDRWhQaw9FWutZhK96J1oY90KmESx66Kx0';
var baseDir = __dirname + "/", gAPIKey = require (baseDir + "gdrive.key.json");
var outputDir = baseDir + "/output/", outputFile = outputDir + "latest.json";

var doc = new GoogleSpreadsheet (sheet_id);
var sheet, matrix = {};

var img = new aig ();
img.fileName ((row) => {
	/* define image file name */
	return outputDir + row.timestamp.replace(/\//g, '').replace(/\:/g, '').replace(/ /g, '') + ".png";
});

img.template ((row) => { return baseDir + "assets/template.png"; } );
img.addFont ('regular', baseDir + "assets/font-regular.ttf");
img.addFont ('bold', baseDir + "assets/font-bold.ttf");

img.addColor ("black", {r: 0, g: 0, b: 0});
img.addColor ("white", {r: 255, g: 255, b: 255});
img.addColor ('red', {r: 221, g: 62, b: 62}); 
img.addColor ('green', {r:69, g:157, b: 82})

img.text ('sitio', {x: 30, y: 280, width: 650, font: 'bold', size: 80, color: 'red', text: (a, r) => { return a ? a.toUpperCase () : '' }})
img.text ('direccion', {x: 30, y: 400, font: 'bold', color: 'green', size: 50, width: 650, multiline: true, text: (a, r) => { return a ? a.replace (/\:/g, ":\n").replace (/\(/, "\n(") : '' } });
img.text ('hora_flyer', {x: 720, y: 280, width: 260, font: 'bold', size: 60, color: 'white', text: (a, r) => { if (!a) return ''; [date, time] = r.timestamp.split (' '); [day, month, year] = date.split('/'); [hour, min, sec] = a.split (':'); ampm = parseInt (hour) >= 12 ? "PM" : "AM"; return day+"/"+month+"/17"+"\n"+hour+":"+min+ampm; }, multiline: true });//should probably use datetime functions but too lazy to parse it
//Lists
img.text ('necesidades', {x:30, y: 650, font: 'regular', color: 'black', size: 20, width: (a, r) => { return a && Array.isArray (a) && a.length > 1 ? 380 : 600; }, multiline: true, text: (a, r) => { return a && Array.isArray (a) ? a [0].join ("\n").replace(/\n\s*\n/g, "\n") : r.necesidad; } });
img.text ('diseno', {x:400, y: 650, font: 'regular', color: 'black', size: 20, width: 300, multiline: true, text: (a, r) => { a = r.necesidades; return a && Array.isArray (a) && a.length > 1 ? a [1].join ("\n").replace (/\n\s*\n/g, "\n") : '' } });
img.text ('publicacion', {x:700, y: 700, font: 'regular', color: 'black', size: 20, width: 300, multiline: true, text: (a, r) => { a = r.necesidades; return a && Array.isArray (a) && a.length > 2 ? a [2].join ("\n").replace (/\n\s*\n/g, "\n") : '' } });

img.text ('seguimiento', {x: 760, y: 645, font: 'bold', color: 'white', size: 75, width: 260, text: (a, r) => { return r.necesidad.includes ("Personas") ? "SÍ" : "NO" } });
var translate = {1: 'timestamp', 2: 'verificador', 3: 'sitio', 4: 'direccion', 5: 'hora_flyer', 6: 'contacto', 7: 'celular', 8: 'necesidad', 9: 'necesidades', 10: 'verificado', 11: 'diseno', 12: 'publicacion', 13: 'seguimiento'};
var min_row = 1, max_row = 50
var filters = {
	necesidades: function (n) { 
		var arr = n.replace(/\(/g, "\n").replace(/\)/g, "").replace (/\./g, "\n").replace(/,/g, "\n").replace(/\n\n/, "\n").split ("\n"), max_items = 10;; 
		return arr.map ( (e, i) => { return i % max_items === 0 ? arr.slice (i, i + max_items) : null }).filter ((e) => {return e;}) 
	}
};

async.series ([
	function setAuth (step) { 
		doc.useServiceAccountAuth (gAPIKey, step);
		return step;
	},
	function getWorksheets (step) {
		doc.getInfo ((error, info) => {
			sheet = info.worksheets [0];
			step ();
		});
	},
	function getCells (step) { 
		sheet.getCells ({
			'min-row': min_row,
		}, (err, cells) => {
			if (err) { console.log (err); throw err; }
			for (var c in cells) { 
				var cell = cells [c];
				if (!matrix [cell.row]) matrix [cell.row] = {};
				if (translate [cell.col]) {
					matrix [cell.row][translate [cell.col]] = filters [translate [cell.col]] ? filters [translate [cell.col]] (cell.value) : cell.value;
				}
			}
			step ();
		});
	},
	function render (step) { 
		img.data (matrix);
		img.render (step);
	},
	function SaveJSON (step) {
		var ll = [];
		for (var r in img._rows) {
			var x = img._rows [r];
			x.file_name = x.file_path.split('\\').pop().split('/').pop()
			x.file_path = '';
			ll.push (x);
		}
		var json = JSON.stringify (ll);
		fs.writeFile (outputFile, json, 'utf8', step);
	}
]);
