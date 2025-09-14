import * as aws from '@pulumi/aws'
import * as awsx from '@pulumi/awsx'
import * as pulumi from '@pulumi/pulumi'

// Import the program's configuration settings.
const config = new pulumi.Config()

// Create an S3 bucket for the SPA
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

// Create a CloudFront CDN to distribute the frontend
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

// Use awsx VPC with automatic subnet creation
const vpc = new awsx.ec2.Vpc('vpc', {
    cidrBlock: '10.0.0.0/16',
    numberOfAvailabilityZones: 2,
    enableDnsHostnames: true,
})

// Security group for ECS
const ecsSecurityGroup = new aws.ec2.SecurityGroup('ecs-sg', {
    vpcId: vpc.vpcId,
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

// Security group for RDS
const rdsSecurityGroup = new aws.ec2.SecurityGroup('rds-sg', {
    vpcId: vpc.vpcId,
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

// Use the VPC's built-in private subnets
const dbSubnetGroup = new aws.rds.SubnetGroup('db-subnet-group', {
    subnetIds: vpc.privateSubnetIds,
})

const dbPassword = config.requireSecret('dbPassword')

// just for simplicity of this project
const dbParameterGroup = new aws.rds.ParameterGroup("postgres-params", {
    family: "postgres17",
    parameters: [
        {
            name: "rds.force_ssl",
            value: "0",
        },
    ],
});

const db = new aws.rds.Instance('postgres-db', {
    engine: 'postgres',
    // smallest known instance
    instanceClass: 'db.t4g.micro',
    allocatedStorage: 20,
    dbSubnetGroupName: dbSubnetGroup.name,
    vpcSecurityGroupIds: [rdsSecurityGroup.id],
    publiclyAccessible: false,
    username: 'appuser',
    password: dbPassword,
    dbName: 'appDb',
    skipFinalSnapshot: true,
    parameterGroupName: dbParameterGroup.name
})

const cluster = new aws.ecs.Cluster('ecs-cluster', {})

// image for the backend server container. To update the version, change it in Pulumi.infra.yaml
const dockerImage = config.require('dockerImage')

const lb = new awsx.lb.ApplicationLoadBalancer('lb', {
    securityGroups: [ecsSecurityGroup.id],
    subnetIds: vpc.publicSubnetIds,
    defaultTargetGroup: {
        port: 4099,
        protocol: "HTTP",
        healthCheck: {
            enabled: true,
            path: "/health",
            protocol: "HTTP",
            port: "4099",
            matcher: "200-399",
            interval: 30,
            timeout: 5,
            healthyThreshold: 2,
            unhealthyThreshold: 3,
        },
    },
    listeners: [
        {
            port: 4099,
            protocol: "HTTP",
        },
    ],
})

const service = new awsx.ecs.FargateService('service', {
    cluster: cluster.arn,
    name: 'bitcoin-guesser-server-service',
    networkConfiguration: {
        assignPublicIp: false,
        securityGroups: [ecsSecurityGroup.id],
        subnets: vpc.privateSubnetIds,
    },
    enableExecuteCommand: true,
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
                { name: 'DB_USERNAME', value: 'appuser' },
                { name: 'DB_PASSWORD', value: dbPassword },
                { name: 'DB_DATABASE', value: 'appDb' },
                { name: 'APPLICATION_PORT', value: '4099' },
            ],
        },
    },
})

const ecsOriginId = 'ecs-service-origin';

const ecsCloudfrontDistribution = new aws.cloudfront.Distribution('ecs-cdn', {
    enabled: true,
    origins: [
        {
            originId: ecsOriginId,
            domainName: lb.loadBalancer.dnsName,
            customOriginConfig: {
                originProtocolPolicy: 'http-only',
                httpPort: 4099,
                httpsPort: 4099,
                originSslProtocols: ['TLSv1.2'],
            },
        },
    ],
    defaultCacheBehavior: {
        targetOriginId: ecsOriginId,
        viewerProtocolPolicy: 'redirect-to-https',
        allowedMethods: ['GET', 'HEAD', 'OPTIONS', 'PUT', 'POST', 'PATCH', 'DELETE'],
        cachedMethods: ['GET', 'HEAD', 'OPTIONS'],
        defaultTtl: 0,
        maxTtl: 0,
        minTtl: 0,
        forwardedValues: {
            queryString: true,
            cookies: {
                forward: 'all',
            },
        },
    },
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

export const serverCDNURL = pulumi.interpolate`https://${ecsCloudfrontDistribution.domainName}`
export const serverLBURL = pulumi.interpolate`http://${lb.loadBalancer.dnsName}`
export const originURL = pulumi.interpolate`http://${bucket.bucketDomainName}`
export const spaCRNURL = pulumi.interpolate`https://${cdn.domainName}`
