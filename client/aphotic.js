var host = "http://198.199.86.30:9500";
var socket = io.connect(host);
var name = "Bob";

var myLoc = [0,0];
var myLocName = '';
var myHealth = 100;
var isDead = false;

var visited = {};

var fsimage = null;

/**
 * WEAPON CLASS
 */
function Weapon(name, desc, damage, image){
    this.name = name;
    this.desc = desc;
    this.damage = damage;
    this.image = image;
}
var myWeapon = null;
/////////////////////////


var players = {};
var KEYMAP = {};


var circles = [];
var texts = [];

socket.on('auth', function(data){
    console.log("try to auth");
    socket.emit('auth', {name: name});
});

socket.on('login', function(data){
    myLoc = data.loc;
    myID = data.id;

    console.log("Got data!");
    console.log(myLoc);
});


function updateWeapon(w){
    myWeapon = w;
    $("#weapon-name").text(w.name);
    $("#weapon-desc").text(w.desc);
    $("#weapon-damage").text(w.damage);
    if (w.image){
        $("#weapon-image").attr("src", w.image);
    }
}

// INIT
function init(){
    updateWeapon(new Weapon("Your soul", "Does it even exist?", 0, null));

    // Start tick
    tick();
}

function repeat(fun, delay, times, counter){
    if (!counter){ counter = 0; }

    if (counter >= times){ return; }
    window.setTimeout(function(){
        fun();
        repeat(fun, delay, times, counter+1);
    }, delay);


}

function move(direction){
    socket.emit('move', {dir: direction});

    var DIRS = {
        'up': [0,-1],
        'down': [0,1],
        'left': [-1,0],
        'right':[1,0]};

    var dirDelta = DIRS[direction];

    repeat(function(){
        for (var i = 0; i < circles.length; i++){
            var c = circles[i];
            c.x = c.x - 3*dirDelta[0];
            c.y = c.y - 3*dirDelta[1];
        }
    }, 30, 20, 0);
}


// Update (other) player data
socket.on('player',function(data){
    var id = data.id;
    var loc = data.loc;
    

    if (id === myID){
        myLoc = loc;
    } else{
        players[id].loc = loc;
    }
});

socket.on('newplayer', function(data){
    console.log("New player!");
    var id = data.id;
    var loc = data.loc;
    var name = data.name;

    players[id] = new Player(name, loc);
});

socket.on('locName', function(data){
    if (myLocName === data.locName){ return; }

    console.log("New location: " + data.locName);
    myLocName = data.locName;

    if (myLocName ===''){
        addText("Lost are you");
    } else{
        addText(myLocName + " has entered in you.");
    }

});

socket.on('etsy', function(data){
    console.log("Received etsy");
    var name = data.name;
    var desc = data.desc.substr(0,300) + "...";
    var damage = data.damage;
    var image = data.image;
    if (damage > myWeapon.damage){
        // CHANGE WEAPON
        var w = new Weapon(name, desc, damage, image);
        addText("Got weapon: " + name, "#7CFF00"); // GREEN
        updateWeapon(w);
    }

});


socket.on('foursquare', function(data){
    console.log("Received foursquare");
    console.log(JSON.stringify(data));
    
    var name = data.venue.name;
    // If already visited then no more
    if (visited[name]){ return; }

    visited[name] = 1;

    addText("A wild '" + name +"' appears!!", "#00FFC9"); // BLUE
    
    if (data.tips && data.tips[0] && data.tips[0].photo && data.tips[0].photo.photourl){
        fsimage = new Image(data.tips[0].photo.photourl);
    } else{
        console.log("no foursquare image??");
    }

    changeHealth(1);
    addText("!!!! +1 !!!!", "green");
});


socket.on('health', function(data){
    if (data.id === myID){
        if (data.delta === 1){
            addText("Leeched health!! +1", "green");
            changeHealth(1);
        } else if (data.delta === -1){
            addText("Someone leeched your health!! -1", "red");
            changeHealth(-1);
        }
    }
});

socket.on('disconnect', function(data){
    delete players[data.id];
});


/**
 * Keypress
 */
$(window).on('keydown',function(e){
    if (isDead){ return; }
    var key = e.which;

    // If already pressed, return
    if (KEYMAP[key]){ return; }


    KEYMAP[key] = 1;


    if (key === 37){
        //LEFT
        move("left");
    } else if (key === 38){
        // UP
        move("up");
    } else if (key ===  39){
        // RIGHT
        move("right");
    } else if (key === 40){
        // DOWN
        move("down");
    } else{
        console.log(e);
    }
});

$(window).on('keyup', function(e){
    var key = e.which;
    if (KEYMAP[key]){
        delete KEYMAP[key];
    }
});

$(window).on('blur', function(e){
    // reset keymap
    KEYMAP = {};
});

function changeHealth(i){
    myHealth += i;
    if (myHealth <= 0){
        myHealth = 0;
        isDead = true;
    }
    $("#health").text(myHealth);
}

/**
 * DRAW FUNCTION
 */
var HEIGHT = 600, WIDTH = 800;
function draw(canvas){
    var closest = null;
    for (var id in players){
        var p = players[id];
        var dist = getDistance(p.loc, myLoc);
        if (closest === null || dist < closest){
            closest = dist;
        }

        // If person nearby!
        if (dist < 1){

            var lonDist = getDistance(p.loc, [myLoc[0], p.loc[1]]);
            // if (lonDist > 180){ lonDist = -(360-lonDist)};
            var latDist = getDistance(p.loc, [p.loc[0], myLoc[1]]);
            // if (latDist > 90){ latDist = -(180-latDist);}



            canvas.drawLine({
                strokeStyle: "yellow",
                x1: WIDTH/2 - WIDTH * (lonDist/1), y1: HEIGHT/2 - HEIGHT*(latDist/1),
                x2: WIDTH/2 + WIDTH * (lonDist/1), y2: HEIGHT/2 +  HEIGHT*(latDist/1),
                strokeWidth: 20,
                opacity: 1-(dist/1)

            });
        }
    }

    if (closest !== null){
        canvas.drawText({
            fillStyle: "white",
            fontSize: "16pt",
            x: WIDTH/2, y: 20,
            text:"Closest soul is " + Math.floor(100*closest) + " away"
        });

        if (closest < 10){

            

        }
    }



    // Autogenerate random circles
    if (Math.floor(Math.random() * 10) === 0){
        circles.push(new Circle(WIDTH*Math.random(), HEIGHT*Math.random()));
    }

    /**
     * Circles
     */
    for (var i = 0; i < circles.length; i++){
        var c = circles[i];
        if (c.dead){
            circles.splice(i,1);
            i--;
        } else{
            // This is a weird case
            if (!c.draw){ return; }

            c.draw(canvas);
        }
    }

    /**
     * Text sprites
     */
    // (yes i know this code is repeated above. shaddup i dont have time)
    for (var i = 0; i < texts.length; i++){
        var t = texts[i];
        if (t.dead){
            texts.splice(i,1);
            i--;
        } else{
            t.draw(canvas);
        }
    }

    // FOURSQUARE IMAGE
    if (fsimage){
        if (fsimage.dead){
            fsimage = null;
        } else{
            fsimage.draw(canvas);
        }
    }


    // LOSE HEALTH
    if (Math.floor(200*Math.random()) === 0){
        addText("!!!! -1 !!!!", "red");
        changeHealth(-1);
    }

    if (isDead){
        canvas.drawText({
            x: WIDTH/2, y: HEIGHT/2,
            text: "YOU'RE DEAD",
            fontSize: "50pt",
            fillStyle: "red"
        });
    }

}


function addText(str, color){
    texts.push(new Text(str, color));
}

/**
 * http://www.movable-type.co.uk/scripts/latlong.html
 */
Number.prototype.toRad = function() {
   return this * Math.PI / 180;
};
function getDistance(loc1, loc2){

    var lon1 = loc1[0]; var lat1 = loc1[1];
    var lon2 = loc2[0]; var lat2 = loc2[1];


    var x1 = lat2-lat1;
    var dLat = x1.toRad();  
    var x2 = lon2-lon1;
    var dLon = x2.toRad();  
    var a = Math.sin(dLat/2) * Math.sin(dLat/2) + 
        Math.cos(lat1.toRad()) * Math.cos(lat2.toRad()) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);  
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 


    return c;


}


var requestAnimationFrame = 
window.requestAnimationFrame ||
window.webkitRequestAnimationFrame ||
window.mozRequestAnimationFrame;

var canvas = $("canvas");
var tick = function(){
    requestAnimationFrame(tick);

    canvas.drawRect({
        fillStyle: "#000",
        x: 0, y: 0,
        width: WIDTH,
        height: HEIGHT,
        fromCenter: false
    });
    draw(canvas);
};


// PLAYER CLASS
function Player(name, loc){
    this.name = name;
    this.loc = loc;
}



function Circle(x, y){
    this.x = x; this.y = y;
    this.opacity = 100;
    this.dead = false;
    this.radius = 1;

    //random color!
    this.color = "rgb(" + Math.floor(256*Math.random()) + "," + Math.floor(256*Math.random()) +
        "," + Math.floor(256*Math.random()) + ")";
}

Circle.prototype.step = function(){
    this.opacity -= 1;
    this.radius += 0.2;
    if (this.opacity < 0){
        this.opacity = 0;
        this.dead = true;
    }

};

Circle.prototype.draw = function(canvas){
    if (this.dead){return;}

    canvas.drawArc({
        fillStyle: this.color,
        x: this.x, y: this.y,
        radius: this.radius,
        opacity: this.opacity/100
    });

    this.step();
};


function Text(str, color){
    this.str = str;

    this.x = 50;
    this.y = 550;

    if (!color){ color = "white"; }

    this.fillStyle = color;
    this.fontSize = "20pt";

    this.opacity = 100;

}

Text.prototype.step = function(){
    this.opacity -= 1;
    this.y -= 1;
    if (this.opacity < 0){
        this.opacity = 0;
        this.dead = true;
    }

};

Text.prototype.draw = function(canvas){
    if (this.dead){return;}

    canvas.drawText({
        x: this.x, y: this.y,
        text: this.str,
        fontSize: this.fontSize,
        fillStyle: this.fillStyle,
        // fontFamily: this.fontFamily,
        align: "left",
        respectAlign: true,
        fromCenter: false,
        opacity: this.opacity/100
    });

    this.step();
};

function Image(src){
    this.src = src;
    this.dead = false;
    this.opacity = 100;
}

Image.prototype.step = function(){
    this.opacity -= 1;
    if (this.opacity < 0){
        this.opacity = 0;
        this.dead = true;
    }

};

Image.prototype.draw = function(canvas){
    if (this.dead){ return; }


    canvas.drawImage({
        source: src,
        x: WIDTH/2, y: HEIGHT/2,
        opacity: this.opacity/100
    });

    this.step();
};

$(document).ready(function(){
    $("button").click(function(){
        // name = $("#input-name").val();
        $("#intro").hide();
        init();
    });
});
