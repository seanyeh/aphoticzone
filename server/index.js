var http = require('http');
var https = require('https');

function AphoticServer(port){
    var fs = require('fs');

    var express = require("express");
    var expressApp = express();

    expressApp.use(express.static('public'));
    this.io = require('socket.io').listen(expressApp.listen(port));
    this.io.set('log level', 1); // reduce logging

    this.users = {};


    /**
     * Socket events
     */
    var self = this;
    self.io.sockets.on('connection', function(socket){
        console.log("Received connection: " + socket);
        socket.emit('auth',{});

        socket.on('auth', function(data){
            console.log("Hello, " + data.name + ", id: " + socket.id);

            //longitude [-180, 180]
            var longitude = Math.floor(360*Math.random()) - 180;
            //latitude [-90,90]
            var latitude = Math.floor(180*Math.random()) - 90;

            var loc = [longitude, latitude];
            


            socket.emit('login', {id:socket.id, loc:loc});

            // Send to user all the already signed in players
            for (var id in self.users){
                var p = self.users[id];
                socket.emit('newplayer', {id:p.id, name:p.name, loc:p.loc});
            }


            // Add user
            self.users[socket.id] = new Player(socket.id, data.name, loc);


            // Send to everyone else about this new player
            socket.broadcast.emit('newplayer', {id:socket.id, name:data.name, loc:loc});
        });

        socket.on('move', function(data){
            var player = self.users[socket.id];
            if (!player){
                console.log("PLAYER UNDEFINED! ERROR");
                return;
            }

            var dir = data.dir;
            if (dir === "up"){
                player.move(0,1);

            } else if (dir === "down"){
                player.move(0,-1);

            } else if (dir === "right"){
                player.move(1,0);

            } else if (dir === "left"){
                player.move(-1,0);

            } else{
                console.log("WTF DIRECTION!!! ERROR");
            }

            // UPDATE ALL USERS WITH NEW LOCATION
            
            // Most people use opposite order of lat, long. i do long,lat
            getJSON('http://api.nytimes.com/svc/semantic/v2/geocodes/query.json?nearby=' +
                    player.loc[1] + ',' + player.loc[0]+ 
                    '&feature_class=P&api-key=d052c797d51382446ed3635bfe4ec97c:4:68189668',
                    function(resp){

                        var locName = '';
                        if (resp && resp.results && resp.results[0]){
                            locName = resp.results[0].concept_name;
                        }
                        socket.emit('locName', {locName: locName});
                    });
            console.log("new location: " + player.loc[0] + "," + player.loc[1]);

            self.io.sockets.emit('player',{id: socket.id, loc: player.loc});



            // SEND RANDOM WEAPON
            sendEtsyWeapon(socket, player);

            getFoursquare(socket, player.loc)

        });


        socket.on('disconnect', function() {
            console.log("Disconnect!");
            socket.broadcast.emit('disconnect', {id:socket.id});
            delete self.users[socket.id];
        });
    });

}


function sendEtsyWeapon(socket, player){
    var page = Math.floor(3000*Math.random());
    getJSON('https://openapi.etsy.com/v2/listings/active?api_key=77v34vbmsxwflbapa1m7gro3' +
            '&page=' + page,
            function(resp){
                var results = resp.results;
                var randomListing = results[Math.floor(results.length * Math.random())];
                if (randomListing){
                    var listingID = randomListing.listing_id;
                    var title = randomListing.title;
                    var desc = randomListing.description;
                    var damage = Math.floor(randomListing.price);
                    if (!listingID){ return; }


                    console.log("Listing id: " + listingID);
                    getJSON('https://openapi.etsy.com/v2/listings/' + listingID +
                        '/images?api_key=77v34vbmsxwflbapa1m7gro3', function(resp2){
                            // Got image!
                            
                            if (!resp2 || !resp2.results || !resp2.results[0]){ return; }
                            var image = resp2.results[0]["url_170x135"];
                            
                            console.log("Sending etsy!");
                            socket.emit('etsy', {name: title, desc: desc, 
                                damage: damage, image: image});

                            // UPDATE WEAPON DAMAGE
                            player.damage = damage;

                        }, true);

                }

            }, true);
}


function getFoursquare(socket, loc){
    var url = "https://api.foursquare.com/v2/venues/explore?ll=" + 
        loc[1] + "," + loc[0] + 
        "&client_id=F220RUDPRWVMKRMYBSI5FOZNU2LBLTWLFWH3LHBBRCJ4RICL&client_secret=ELMKOCOKRMNDYDKD0YDI4L4WPHOHZ2EUGW2OIKNTFFXFCOF3";
    getJSON(url, function(resp){
        if (resp.response && resp.response.groups && resp.response.groups[0] && 
            resp.response.groups[0].items && resp.response.groups[0].items.length > 0){

                var items = resp.response.groups[0].items;
                var randomItem = items[Math.floor(items.length * Math.random())];
                var id = random.venue.id;

                if (id){



                    random.myPhotoSrc = img;
                    socket.emit('foursquare', randomItem);
                }
            }

    }, true);
}

function getJSON(url, cbfun, secure){
    var h = http;
    if (secure){
        h = https;
    }

    h.get(url, function(res) {
        var body = '';

        res.on('data', function(chunk) {
            body += chunk;
        });

        res.on('end', function() {
            try{
                var resp = JSON.parse(body);
                cbfun(resp);
            } catch (e){
                console.log("JSON Error?");
                console.log(JSON.stringify(e));
                return;
            }
            


        });
    }).on('error', function(e) {
        console.log("Got error: ", e);
    });

}


Number.prototype.toRad = function() {
   return this * Math.PI / 180;
};
function getDistance(loc1, loc2){
    if(!loc1 || !loc2){ return Infinity; }

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

// PLAYER CLASS
function Player(id, name, loc){
    this.id = id;
    this.name = name;
    this.loc = loc;
    this.health = 100;
    this.damage = 0;
}

Player.prototype.move = function(longDelta, latDelta){
    this.loc[0] += longDelta;

    if (this.loc[0] > 180){
        this.loc[0] = -180 + (this.loc[0] - 180);
    }
    else if (this.loc[0] < -180){
        this.loc[0] = 180 - Math.abs(this.loc[0] - 180);
    }


    this.loc[1] += latDelta;
    if (this.loc[1] > 90){
        this.loc[1] = -90 + (this.loc[1] - 90);
    }
    else if (this.loc[1] < -90){
        this.loc[1] = 90 - Math.abs(this.loc[1] - 90);
    }
}


AphoticServer.prototype.leech = function(){
    var usersArr = [];
    for (var id in this.users){
        usersArr.push(this.users[id]);
    }

    if (usersArr.length < 2){ return; }

    var i1 = Math.floor(usersArr.length*Math.random());
    var p1 = usersArr[i1];
    usersArr.splice(i1,1);

    var p2 = usersArr[Math.floor(usersArr.length*Math.random())];

    if (getDistance(p1.loc, p2.loc) < 0.3){
        console.log("LEECH");
        
        // Assume p1 is stronger

        if (p2.damage > p1.damage){
            this.io.sockets.emit('health', {delta: -1, id: p1.id});
            this.io.sockets.emit('health', {delta: 1, id: p2.id});
        } else{

            this.io.sockets.emit('health', {delta: 1, id: p1.id});
            this.io.sockets.emit('health', {delta: -1, id: p2.id});
        }

        

    }


}



// Main

var port = 9500;
if (process.argv[2]){
    port = process.argv[2];
}
console.log("Running on port: " + port);

var qs = new AphoticServer(port);

setInterval(function(){
    qs.leech();
}, 1000);
