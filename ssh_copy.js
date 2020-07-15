let ip = {
    url: "http://whatismyip.akamai.com/"
};

const {
    exec
} = require("child_process");


let fs = require("fs");
let colors = require('colors');
let curl = require("curlrequest");
let inquirer = require('inquirer');
let sendmail = require("./sendmail");
let config = require("./server.json");
let CronJob = require("cron").CronJob;
let deleteFolder = require("./delete");
let WebTorrent = require("webtorrent");
let SftpClient = require("ssh2-sftp-client");

let remoteFile;
let jobcount = 0;
let sftp = new SftpClient();
let client = new WebTorrent()

process.argv[2]

if (process.argv[2] === "--help" || typeof process.argv[2] === "string") {

    console.log(`\n ssh_copy downloads torrents and moves to folders of choice.

usage:
  ssh_copy <command>

  commands can be:

  Movies: Moves data to the movie folder.
  Music: Moves data to the music folder.
  --help: Used to print the usage guide. \n`);

    process.exit();

};

let questions = [{
        type: 'input',
        name: 'mag',
        message: "Please add Magnet Url Seperated by a space:",
    },
    {
        type: 'input',
        name: 'folder',
        message: "Inputs Folder Location:",
    }
];

function whenDone(callback) {

    inquirer.prompt(questions).then(answers => {

        if (answers.folder === "Movies") {

            remoteFile = "/mnt/raid/Movies/"
            file = "/media/more_data/Movies/"
        } else if (answers.folder === "Music") {

            remoteFile = "/mnt/raid/Music/"
            file = "/media/more_data/Music/"
        } else {

            console.log("\n" + "Inputs dont match acceptable data check --help for more information.".red);
            process.exit();
        };

        let count = 0;
        let text = answers.mag.split(" ");
        console.log(colors.yellow("\n" + text + "\n"));
        //Start Webtorrent
        for (let i = 0; i < text.length; i++) {

            client.add(text[i], {
                path: file
            }, function (torrent) {

                let interval = setInterval(function () {
                    console.log('Progress: ' + (client.progress * 100).toFixed(1) + '%'.cyan);
                }, 5000)

                torrent.on('done', function () {
                    count++;

                    console.log(`Torrent download ${count} completed... \n`.green)

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
                            console.log(`Folder - "${found}" is already on Server`.red);
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
                    console.log(`Error: ${err.message} \n`.red);

                    curl.request(ip, function (err, data) {
                        console.log(`Public Ip Address \n ${data} \n`.yellow);
                    });
                });

        });
    };

    tranferFile(function (err, found) {

        if (found === 'DontRun') {

            //Check Current IP Addresss
            let job1 = new CronJob('* * * * *', function () {
                curl.request(ip, function (err, data) {
                    console.log(`Public Ip Address \n ${data} \n`.yellow);
                });
            });

            job1.start();

        } else if (found === 'Run') {
            //Count amount of time job has ran
            jobcount++

            console.log(`Run Times: ${jobcount} \n`);

            curl.request(ip, function (err, data) {

                //Display Public IP address
                console.log(`Public Ip Address \n ${data} \n`.yellow);

                if (data === '98.191.99.68' && jobcount === 1) {

                    //SSH Connection Upload to Server
                    async function main() {

                        let client = new SftpClient();
                        const src = file;
                        const dst = remoteFile;

                        try {
                            await client.connect(config);
                            client.on('upload', info => {

                                console.log(`Listener: Uploaded ${info.source} \n`.green);

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
                            console.log(colors.green(msg, "\n"));
                        })
                        .catch(err => {
                            console.log(`main error: ${err.message} \n`.red);

                            curl.request(ip, function (err, data) {
                                console.log(`Public Ip Address \n ${data} \n`.yellow);
                            });
                        });

                } else {
                    console.log("\n" + "No Files to Upload" + "\n".rainbow);
                };
            });

        };
    });

});
