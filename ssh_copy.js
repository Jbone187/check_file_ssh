let ip = {
    url: "http://whatismyip.akamai.com/"
};

const {
    exec
} = require("child_process");


let fs = require("fs");
let curl = require("curlrequest");
let sendmail = require("./sendmail");
let deleteFolder = require("./delete");
let CronJob = require("cron").CronJob;
let WebTorrent = require("webtorrent");
let SftpClient = require("ssh2-sftp-client");

let remoteFile;
let jobcount = 0;
let sftp = new SftpClient();
let client = new WebTorrent()

process.argv[2]


const config = {
    host: '',
    username: '',
    password: '',
    port: ''
};

if (process.argv[2] === "Movies") {
    remoteFile = "/mnt/raid/Movies/"
    file = "/media/more_data/Movies/"
} else if (process.argv[2] === "Music") {
    remoteFile = "/mnt/raid/Music/"
    file = "/media/more_data/Music/"
} else {
    console.log("Wrong Choice")
    process.exit();
};


function whenDone(callback) {

    fs.readFile('torrent.txt', 'utf8', (err, data) => {
        if (err) throw err;
        let count = 0;
        let text = data.split(" ");
        console.log(text + '\n');
        //Start Webtorrent
        for (let i = 0; i < text.length; i++) {

            client.add(text[i], {
                path: file
            }, function (torrent) {

                let interval = setInterval(function () {
                    console.log('Progress: ' + (client.progress * 100).toFixed(1) + '%')
                }, 5000)

                torrent.on('done', function () {
                    count++;

                    console.log(`Torrent download ${count} completed... \n`)

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
    //Turn Off VPN
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
        //Pull directory list
        fs.readdir('/media/more_data/Movies', function (err, files) {
            //Pull Directory List from Server
            if (err) {
                return console.log('Unable to scan directory: ' + err);
            }

            sftp.connect(config)
                .then(() => {
                    return sftp.list(remoteFile)
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
                    //Search Server List Data 
                    let createUndefinded = (values) => values === undefined;
                    let arrValue = arr1.every(createUndefinded);

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
            //Count amount of time job has ran
            jobcount++

            console.log(`Run Times: ${jobcount} \n`);

            curl.request(ip, function (err, data) {

                //Display Public IP address
                console.log(`Public Ip Address \n ${data} \n`);

                if (data === '' && jobcount === 1) {

                    //SSH Connection Upload to Server
                    async function main() {

                        let client = new SftpClient();
                        const src = file;
                        const dst = remoteFile;

                        try {
                            await client.connect(config);
                            client.on('upload', info => {

                                console.log(`Listener: Uploaded ${info.source} \n`);

                                fs.appendFile('logs.txt', `${info.source} \n`, (err) => {
                                    if (err) throw err;
                                });
                            });
                            let rslt = await client.uploadDir(src, dst);
                            return rslt;
                        } finally {
                            client.end();
                            sendmail();
                            deleteFolder();
                        };
                    };

                    main()
                        .then(msg => {
                            console.log(msg, "\n");
                        })
                        .catch(err => {
                            console.log(`main error: ${err.message}`);
                        });

                } else {
                    console.log("\n" + "No Files to Upload" + "\n");
                };
            });

        };
    });

});
