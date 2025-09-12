import * as pulumi from '@pulumi/pulumi'
import * as aws from '@pulumi/aws'
import * as synced_folder from '@pulumi/synced-folder'
import * as awsx from '@pulumi/awsx'

// Import the program's configuration settings.
const config = new pulumi.Config()

// Create an S3 bucket and configure it as a website.
const bucket = new aws.s3.Bucket('bucket')

const bucketPolicy = new aws.s3.BucketPolicy('bucketPolicy', {
    bucket: bucket.bucket,
    policy: bucket.bucket.apply((bucketName) =>
        JSON.stringify({
            Version: '2012-10-17',
            Statement: [
                {
                    Effect: 'Allow',
                    Principal: '*',
                    Action: ['s3:GetObject'],
                    Resource: [`arn:aws:s3:::${bucketName}/*`],
                },
            ],
        }),
    ),
})

// Configure ownership controls for the new S3 bucket
const ownershipControls = new aws.s3.BucketOwnershipControls('ownership-controls', {
    bucket: bucket.bucket,
    rule: {
        objectOwnership: 'ObjectWriter',
    },
})

// Configure public ACL block on the new S3 bucket
const publicAccessBlock = new aws.s3.BucketPublicAccessBlock('public-access-block', {
    bucket: bucket.bucket,
    blockPublicAcls: false,
})

// Create a CloudFront CDN to distribute and cache the website.
const cdn = new aws.cloudfront.Distribution('cdn', {
    enabled: true,
    origins: [
        {
            originId: bucket.arn,
            domainName: bucket.bucketDomainName,
            customOriginConfig: {
                originProtocolPolicy: 'http-only',
                httpPort: 80,
                httpsPort: 443,
                originSslProtocols: ['TLSv1.2'],
            },
        },
    ],
    defaultCacheBehavior: {
        targetOriginId: bucket.arn,
        viewerProtocolPolicy: 'redirect-to-https',
        allowedMethods: ['GET', 'HEAD', 'OPTIONS'],
        cachedMethods: ['GET', 'HEAD', 'OPTIONS'],
        defaultTtl: 600,
        maxTtl: 600,
        minTtl: 600,
        forwardedValues: {
            queryString: true,
            cookies: {
                forward: 'all',
            },
        },
    },
    // priceClass for europe
    priceClass: 'PriceClass_100',
    restrictions: {
        geoRestriction: {
            restrictionType: 'none',
        },
    },
    viewerCertificate: {
        cloudfrontDefaultCertificate: true,
    },
})

const vpc = new aws.ec2.Vpc('vpc', {
    cidrBlock: '10.0.0.0/16',
    enableDnsHostnames: true,
})

const publicSubnet = new aws.ec2.Subnet('public-subnet', {
    vpcId: vpc.id,
    cidrBlock: '10.0.1.0/24',
    mapPublicIpOnLaunch: true,
})

const privateSubnet = new aws.ec2.Subnet('private-subnet', {
    vpcId: vpc.id,
    cidrBlock: '10.0.2.0/24',
    mapPublicIpOnLaunch: false,
    availabilityZone: 'eu-central-1c',
})

// second subnet to prevent DBSubnetGroupDoesNotCoverEnoughAZs error
const privateSubnet2 = new aws.ec2.Subnet('private-subnet-2', {
    vpcId: vpc.id,
    cidrBlock: '10.0.3.0/24',
    mapPublicIpOnLaunch: false,
    availabilityZone: 'eu-central-1b',
})

const internetGateway = new aws.ec2.InternetGateway('igw', {
    vpcId: vpc.id,
})

const publicRouteTable = new aws.ec2.RouteTable('public-rt', {
    vpcId: vpc.id,
    routes: [
        {
            cidrBlock: '0.0.0.0/0',
            gatewayId: internetGateway.id,
        },
    ],
})

new aws.ec2.RouteTableAssociation('public-rt-assoc', {
    subnetId: publicSubnet.id,
    routeTableId: publicRouteTable.id,
})

const privateRouteTable = new aws.ec2.RouteTable('private-rt', {
    vpcId: vpc.id,
})

new aws.ec2.RouteTableAssociation('private-rt-assoc', {
    subnetId: privateSubnet.id,
    routeTableId: privateRouteTable.id,
})

// Security group for ECS (allow inbound from internet to API port, and outbound to RDS)
const ecsSecurityGroup = new aws.ec2.SecurityGroup('ecs-sg', {
    vpcId: vpc.id,
    description: 'Allow HTTP access from internet and DB access to RDS',
    ingress: [
        {
            protocol: 'tcp',
            fromPort: 4099,
            toPort: 4099,
            cidrBlocks: ['0.0.0.0/0'],
        },
    ],
    egress: [
        {
            protocol: '-1',
            fromPort: 0,
            toPort: 0,
            cidrBlocks: ['0.0.0.0/0'],
        },
    ],
})

// Security group for RDS (only allow access from ECS tasks)
const rdsSecurityGroup = new aws.ec2.SecurityGroup('rds-sg', {
    vpcId: vpc.id,
    description: 'Allow PostgreSQL access from ECS only',
    ingress: [
        {
            protocol: 'tcp',
            fromPort: 5432,
            toPort: 5432,
            securityGroups: [ecsSecurityGroup.id],
        },
    ],
})

// RDS PostgreSQL instance
const dbSubnetGroup = new aws.rds.SubnetGroup('db-subnet-group', {
    subnetIds: [privateSubnet.id, privateSubnet2.id],
})

const dbPassword = config.requireSecret('dbPassword')

const db = new aws.rds.Instance('postgres-db', {
    engine: 'postgres',
    instanceClass: 'db.t4g.micro',
    allocatedStorage: 20,
    dbSubnetGroupName: dbSubnetGroup.name,
    vpcSecurityGroupIds: [rdsSecurityGroup.id],
    publiclyAccessible: false,
    username: 'appuser',
    password: dbPassword,
    dbName: 'appDb',
    skipFinalSnapshot: true,
})

// ECS Cluster
const cluster = new aws.ecs.Cluster('ecs-cluster', {})

// ECS Task Definition
const dockerImage = config.require('dockerImage') // e.g. "yourrepo/yourimage:latest"

const lb = new awsx.lb.ApplicationLoadBalancer('lb', {
    defaultTargetGroupPort: 4099,
})

const service = new awsx.ecs.FargateService('service', {
    cluster: cluster.arn,
    assignPublicIp: true,
    name: 'bitcoin-guesser-server-service',
    taskDefinitionArgs: {
        container: {
            name: 'bitcoin-guesser-server',
            image: dockerImage,
            cpu: 10,
            memory: 256,
            essential: true,
            portMappings: [
                {
                    containerPort: 4099,
                    hostPort: 4099,
                    targetGroup: lb.defaultTargetGroup,
                },
            ],
            environment: [
                { name: 'DB_HOST', value: db.address },
                { name: 'DB_USER', value: 'appuser' },
                { name: 'DB_PASS', value: dbPassword },
                { name: 'DB_NAME', value: 'appdb' },
            ],
        },
    },
})

export const backendURL = pulumi.interpolate`http://${lb.loadBalancer.dnsName}`

// Export the URLs and hostnames of the bucket and distribution.
export const originURL = pulumi.interpolate`http://${bucket.bucketDomainName}`
export const originHostname = bucket.bucketDomainName
export const cdnURL = pulumi.interpolate`https://${cdn.domainName}`
export const cdnHostname = cdn.domainName
