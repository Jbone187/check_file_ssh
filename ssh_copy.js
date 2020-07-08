let ip = {
    url: "http://whatismyip.akamai.com/"
};

const {
    exec
} = require("child_process");


let fs = require('fs');
let curl = require("curlrequest");
let CronJob = require('cron').CronJob;
let WebTorrent = require('webtorrent')
let SftpClient = require('ssh2-sftp-client');

let sftp = new SftpClient();
let client = new WebTorrent()

const config = {
    host: '',
    username: '',
    password: '',
    port: ''
};

function whenDone(callback) {

    fs.readFile('torrent.txt', 'utf8', (err, data) => {
        if (err) throw err;
        let count = 0;
        let text = data.split(" ");
        console.log(text + '\n');

        for (let i = 0; i < text.length; i++) {

            client.add(text[i], {
                path: '/media/more_data/Movies'
            }, function (torrent) {

                let interval = setInterval(function () {
                    console.log('Progress: ' + (client.progress * 100).toFixed(1) + '%')
                }, 5000)

                torrent.on('done', function () {
                    count++;

                    console.log(`Torrent download finished ${count}`)

                    if (count === text.length) {

                        let done = "done";
                        callback(done)
                    };

                    clearInterval(interval)

                });
            });
        };

    });

};

whenDone(function (done) {
    //console.log(done)
    if (done) {

        let vpnstop = exec('sh /home/jasen/ssh_copy/vpn_stop.sh');

        vpnstop.stdout.on('data', (data) => {
            console.log(data);

        });

        mainJob.start();
    }

});


let mainJob = new CronJob('*/5 * * * *', function () {

    function tranferFile(callback) {

        fs.readdir('/media/more_data/Movies', function (err, files) {
            //handling error
            if (err) {
                return console.log('Unable to scan directory: ' + err);
            }

            sftp.connect(config)
                .then(() => {
                    return sftp.list('/mnt/raid/Movies')
                })
                .then(data => {

                    let found;
                    let arr1 = [];

                    for (let i = 0; i < data.length; i++) {

                        found = files.find(movie => movie === data[i].name);
                        arr1.push(found)

                        if (found) {
                            console.log(`Folder - "${found}" is already on Server`);
                            found = 'DontRun';
                            callback(null, found);
                            break;
                        };
                    };

                    let createUndefinded = (values) => values === undefined;
                    let arrValue = arr1.every(createUndefinded)

                    console.log(arrValue)

                    if (arrValue) {
                        found = 'Run';
                        callback(null, found);
                    };
                    sftp.end();

                }).catch(err => {
                    console.log(`Error: ${err.message}`);
                });

        });
    };

    tranferFile(function (err, found) {

        if (found === 'DontRun') {

            //Check Current IP Addresss
            let job1 = new CronJob('* * * * *', function () {
                curl.request(ip, function (err, data) {
                    console.log(`Public Ip Address \n ${data} \n`);
                });
            });

            job1.start();

        } else if (found === 'Run') {

            curl.request(ip, function (err, data) {

                //Display Public IP address
                console.log(`Public Ip Address \n ${data} \n`);

                if (data === '98.191.99.68') {

                    //SSH Connection
                    async function main() {

                        let client = new SftpClient();
                        const src = '/media/more_data/Movies';
                        const dst = '/mnt/raid/Movies';

                        try {
                            await client.connect(config);
                            client.on('upload', info => {
                                console.log(`Listener: Uploaded ${info.source}`);
                            });
                            let rslt = await client.uploadDir(src, dst);
                            return rslt;
                        } finally {
                            client.end();
                        };
                    };

                    main()
                        .then(msg => {
                            console.log(msg);
                        })
                        .catch(err => {
                            console.log(`main error: ${err.message}`);
                        });

                } else {
                    console.log("\n" + "You are not Connected to the Network..." + "\n");
                };
            });

        };
    });

});
