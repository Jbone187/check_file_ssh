let ip = {
    url: "http://whatismyip.akamai.com/"
};

let fs = require('fs');
let curl = require("curlrequest");
let CronJob = require('cron').CronJob;
let SftpClient = require('ssh2-sftp-client');

let sftp = new SftpClient();

const config = {
    host: '',
    username: '',
    password: '',
    port: ''
};

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

                if (data === '') {

                    //SSH Connection
                    async function main() {
                        const client = new SftpClient('');
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

mainJob.start();
