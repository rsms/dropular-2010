# Setting up an EC2 instance

## Prerequisites

- [Amazon EC2 command line tools](http://developer.amazonwebservices.com/connect/entry.jspa?externalID=351&categoryID=88)

It is recommended to put the contents of the zip file referenced in the above web page in `~/.ec2`. First, unzip the file, then:

    mv ec2-api-tools-1.3-46266 ~/.ec2
    chmod 0700 ~/.ec2

Now, you need to add the tools to your `PATH`. Edit your `~/.bashrc` file and add these lines somewhere:

    if [ -d ~/.ec2 ]; then
      export EC2_HOME="$HOME/.ec2"
      export PATH=$PATH:$EC2_HOME/bin
      export EC2_PRIVATE_KEY=`ls $EC2_HOME/pk-*.pem`
      export EC2_CERT=`ls $EC2_HOME/cert-*.pem`
      export JAVA_HOME=/System/Library/Frameworks/JavaVM.framework/Home/
    fi

Download the X.509 certificates from the Amazon AWS accounts page and put them into `~/.ec2` and secure permissions (`chmod 0400 ~/.ec2/*.pem`).

Now, listing the contents of `~/.ec2` should now yield something like this:

    $ ls -l ~/.ec2
    drwxrwxr-x  352 rasmus  staff  11968 13 Dec 22:25 bin
    -r--------    1 rasmus  staff    916 17 Apr 13:56 cert-xxxxxxxxx.pem
    -r--------    1 rasmus  staff   1693 17 Apr 13:31 dropular-ec2-1.pem
    drwxrwxr-x   26 rasmus  staff    884 13 Dec 22:25 lib
    -r--------    1 rasmus  staff    922 17 Apr 13:56 pk-xxxxxxxxx.pem

> **IMPORTANT --** THE `pem` FILES ARE CONFIDENTIAL AND SHALL NEVER FALL INTO THE HANDS OF OTHER PEOPLE, as they are the key to controlling anything.

## Creating and configuring a new EC2 instance

Choose an instance id. This should be in the form "dropular-ec2-N" where "N" is the next natural number:

    INSTANCEID='dropular-ec2-2'

Now, create a key pair and launch a new instance with that key pair:

    mkdir -p ~/.ec2 && chmod 0700 ~/.ec2
    ec2-add-keypair $INSTANCEID > ~/.ec2/$INSTANCEID.pem
    chmod 0400 ~/.ec2/$INSTANCEID.pem
    ec2-run-instances ami-19a34270 -k $INSTANCEID

> `ami-19a34270` is a 32bit Ubuntu 9.10 "karmic" image from Alestic for the Virigina site. `ami-2fc2e95b` is an alternative 32bit Ubuntu 9.10 "karmic" image for the EU site.

Create a SSH short-hand alias:

    HOSTNAME=$(ec2-describe-instances | grep $INSTANCEID | awk '{print $4}')
    echo "Host $INSTANCEID" >> ~/.ssh/config
    echo "  HostName $HOSTNAME" >> ~/.ssh/config
    echo "  User root" >> ~/.ssh/config
    echo "  IdentityFile $HOME/.ec2/$INSTANCEID.pem" >> ~/.ssh/config
    chmod 0600 ~/.ssh/config

Also, make sure the security group in which the instance is operating in (`default` by default) have the appropriate ports opened:

    ec2-authorize default -p 22
    ec2-authorize default -p 80
    ec2-authorize default -p 8100-8199

Now, you can log in to the server by referencing the `$INSTANCEID`. E.g:

    ssh $INSTANCEID

> If the instance was started in a special region, include the `--region` option when calling the ec2 commands. E.g. `ec2-authorize --region eu-west-1 default -p 22`

## Setting up the system

> If you see lines like this `E: dpkg was interrupted, you must manually run 'sudo dpkg --configure -a' to correct the problem.` -- simply run `dpkg --configure -a` and re-run `apt-get install x` until completed. This is a EC2 specific issue.

    apt-get update
    apt-get install build-essential libc6-dev libstdc++6 git-core
    mkdir -p ~/src

**Node:**

    cd ~/src
    git clone git://github.com/ry/node.git
    cd node && git checkout v0.1.94
    ./configure && make && make install

**CouchDB:**

    apt-get install erlang libicu-dev libmozjs-dev libcurl4-openssl-dev
    cd ~/src
    wget http://www.apache.org/dist/couchdb/0.11.0/apache-couchdb-0.11.0.tar.gz
    tar xfz apache-couchdb-0.11.0.tar.gz && cd apache-couchdb-0.11.0
    adduser --system --home /var/lib/couchdb --no-create-home\
      --shell /bin/bash --group --gecos 'CouchDB Administrator' couchdb
    ./configure --prefix ''
    make && make install
    update-rc.d couchdb defaults
    invoke-rc.d couchdb start

**Dropular user:**

    adduser --system --home /var/dropular --shell /bin/bash --group\
      --gecos 'Dropular system user' dropular

**Git deploy key:**

Chose all default answers asked by `ssh-keygen`

    sudo su dropular
    ssh-keygen
    less ~/.ssh/id_rsa.pub

Copy the output from less and create a new deploy key at [https://github.com/rsms/dropular/edit](https://github.com/rsms/dropular/edit) -- name it `$INSTANCEID` (e.g. "dropular-ec2-2").

**`/var/dropular`:**

    apt-get install daemon imagemagick
    sudo su dropular
    cd
    git clone git://github.com/rsms/oui.git && oui/client/build.sh -s
    git clone git://github.com/rsms/node-couchdb-min.git
    git clone git://github.com/rsms/node-imagemagick.git
    git clone git@github.com:rsms/dropular.git && dropular/build.sh -s
    # ^D -- log out dropular and be logged in as root
    ln -s /var/dropular/dropular/misc/init.d/dropular-httpd /etc/init.d/
    update-rc.d dropular-httpd defaults
    $EDITOR /etc/default/dropular-httpd
    # enter something like: DR_HTTPD_PORTS="8100 8101"
    invoke-rc.d dropular-httpd start

**nginx:**

    apt-get install nginx
    cd /etc/nginx/sites-enabled
    cp /var/dropular/dropular/misc/nginx.conf ../sites-available/dropular
    ln -s ../sites-available/dropular
    $EDITOR dropular
    # edit dropular_backends to match DR_HTTPD_PORTS in /etc/defaults/dropular-httpd
    invoke-rc.d nginx restart

## Setting up the data

First, create a temporary tunnel to the instance from which you want to replicate (while being logged in on the EC2 instance):

    ssh -L5984:127.0.0.1:5984 rasmus@hunch.se

In a new terminal (logged in to the EC2 instance):

    curl -X PUT http://127.0.0.1:5984/dropular-{users,drops,newslist}
    curl -vX POST http://127.0.0.1:5984/_replicate -d\
      '{"source":"http://127.0.0.1:5985/dropular-drops","target":"dropular-drops"}'
    curl -vX POST http://127.0.0.1:5984/_replicate -d\
      '{"source":"http://127.0.0.1:5985/dropular-users","target":"dropular-users"}'

This will take some time, depending on the load of the source instance and the amount of data (normally about 10 minutes).

## Testing the dropular server

    cd /var/dropular/dropular
    ./build.sh -s
    ./httpd.js -d

