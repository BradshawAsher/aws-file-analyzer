@minLength(1)
param environmentName string
param location string = resourceGroup().location
param tags object = {}
param principalId string
param principalName string
param tenantId string
param cloudflareAllowedOrigin string
param deployerIpAddress string = ''

var resourceToken = toLower(uniqueString(subscription().id, environmentName, location))
var appServicePlanName = 'plan-afa-${resourceToken}'
var apiName = 'app-afa-${resourceToken}'
var sqlServerName = 'sql-afa-${resourceToken}'
var sqlDatabaseName = 'FileAnalyzer'
var keyVaultName = 'kv-afa-${resourceToken}'
var logAnalyticsName = 'log-afa-${resourceToken}'
var applicationInsightsName = 'appi-afa-${resourceToken}'
var keyVaultSecretsUserRoleId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6')
var keyVaultSecretsOfficerRoleId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'b86a8fe4-44ce-4948-aee5-eccb2c155cd7')

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: logAnalyticsName
  location: location
  tags: tags
  properties: {
    features: {
      disableLocalAuth: false
      enableLogAccessUsingOnlyResourcePermissions: true
    }
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
    retentionInDays: 30
    sku: {
      name: 'PerGB2018'
    }
  }
}

resource applicationInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: applicationInsightsName
  location: location
  kind: 'web'
  tags: tags
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalytics.id
    RetentionInDays: 30
    SamplingPercentage: 10
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
}

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: keyVaultName
  location: location
  tags: tags
  properties: {
    tenantId: tenantId
    sku: {
      family: 'A'
      name: 'standard'
    }
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 7
    publicNetworkAccess: 'Enabled'
    networkAcls: {
      bypass: 'AzureServices'
      defaultAction: 'Allow'
    }
  }
}

resource appServicePlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: appServicePlanName
  location: location
  kind: 'linux'
  tags: tags
  sku: {
    name: 'F1'
    tier: 'Free'
    capacity: 1
  }
  properties: {
    reserved: true
  }
}

resource sqlServer 'Microsoft.Sql/servers@2023-08-01' = {
  name: sqlServerName
  location: location
  tags: tags
  properties: {
    administrators: {
      administratorType: 'ActiveDirectory'
      azureADOnlyAuthentication: true
      login: principalName
      principalType: 'User'
      sid: principalId
      tenantId: tenantId
    }
    minimalTlsVersion: '1.2'
    publicNetworkAccess: 'Enabled'
    restrictOutboundNetworkAccess: 'Disabled'
    version: '12.0'
  }
}

resource azureOnlyAuthentication 'Microsoft.Sql/servers/azureADOnlyAuthentications@2023-08-01' = {
  parent: sqlServer
  name: 'Default'
  properties: {
    azureADOnlyAuthentication: true
  }
}

resource sqlDatabase 'Microsoft.Sql/servers/databases@2023-08-01' = {
  parent: sqlServer
  name: sqlDatabaseName
  location: location
  tags: tags
  sku: {
    name: 'GP_S_Gen5_1'
    tier: 'GeneralPurpose'
    family: 'Gen5'
    capacity: 1
  }
  properties: {
    autoPauseDelay: 60
    createMode: 'Default'
    freeLimitExhaustionBehavior: 'AutoPause'
    maxSizeBytes: 34359738368
    minCapacity: json('0.5')
    requestedBackupStorageRedundancy: 'Local'
    useFreeLimit: true
    zoneRedundant: false
  }
}

resource allowAzureServices 'Microsoft.Sql/servers/firewallRules@2023-08-01' = {
  parent: sqlServer
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

resource allowDeployer 'Microsoft.Sql/servers/firewallRules@2023-08-01' = if (!empty(deployerIpAddress)) {
  parent: sqlServer
  name: 'AllowDeploymentMachine'
  properties: {
    startIpAddress: deployerIpAddress
    endIpAddress: deployerIpAddress
  }
}

resource api 'Microsoft.Web/sites@2023-12-01' = {
  name: apiName
  location: location
  kind: 'app,linux'
  tags: union(tags, {
    'azd-service-name': 'api'
  })
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    clientAffinityEnabled: false
    httpsOnly: true
    publicNetworkAccess: 'Enabled'
    serverFarmId: appServicePlan.id
    siteConfig: {
      alwaysOn: false
      ftpsState: 'Disabled'
      healthCheckPath: '/health'
      http20Enabled: true
      linuxFxVersion: 'DOTNETCORE|8.0'
      appCommandLine: 'dotnet OpenAiChat.dll'
      minTlsVersion: '1.2'
      scmMinTlsVersion: '1.2'
      appSettings: [
        {
          name: 'ASPNETCORE_ENVIRONMENT'
          value: 'Production'
        }
        {
          name: 'SCM_DO_BUILD_DURING_DEPLOYMENT'
          value: 'false'
        }
        {
          name: 'WEBSITE_HEALTHCHECK_MAXPINGFAILURES'
          value: '3'
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: applicationInsights.properties.ConnectionString
        }
        {
          name: 'ApplicationInsightsAgent_EXTENSION_VERSION'
          value: '~3'
        }
        {
          name: 'ConnectionStrings__DefaultConnection'
          value: 'Server=tcp:${sqlServer.properties.fullyQualifiedDomainName},1433;Database=${sqlDatabase.name};Authentication=Active Directory Default;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;'
        }
        {
          name: 'Cors__AllowedOrigins__0'
          value: cloudflareAllowedOrigin
        }
        {
          name: 'Gemini__ApiKey'
          value: '@Microsoft.KeyVault(SecretUri=${keyVault.properties.vaultUri}secrets/gemini-api-key/)'
        }
        {
          name: 'Jwt__Key'
          value: '@Microsoft.KeyVault(SecretUri=${keyVault.properties.vaultUri}secrets/jwt-key/)'
        }
        {
          name: 'Jwt__Issuer'
          value: 'AwsFileAnalyzerApi'
        }
        {
          name: 'Jwt__Audience'
          value: 'AwsFileAnalyzerFrontend'
        }
        {
          name: 'Jwt__ExpiresInMinutes'
          value: '60'
        }
        {
          name: 'AWS__Region'
          value: 'us-east-2'
        }
        {
          name: 'AWS__S3BucketName'
          value: 'aws-file-analyzer-bd3b69e5'
        }
        {
          name: 'AWS_REGION'
          value: 'us-east-2'
        }
        {
          name: 'AWS_ACCESS_KEY_ID'
          value: '@Microsoft.KeyVault(SecretUri=${keyVault.properties.vaultUri}secrets/aws-access-key-id/)'
        }
        {
          name: 'AWS_SECRET_ACCESS_KEY'
          value: '@Microsoft.KeyVault(SecretUri=${keyVault.properties.vaultUri}secrets/aws-secret-access-key/)'
        }
      ]
    }
  }
}

resource apiSecretsRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, api.id, keyVaultSecretsUserRoleId)
  scope: keyVault
  properties: {
    principalId: api.identity.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: keyVaultSecretsUserRoleId
  }
}

resource deployerSecretsRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, principalId, keyVaultSecretsOfficerRoleId)
  scope: keyVault
  properties: {
    principalId: principalId
    principalType: 'User'
    roleDefinitionId: keyVaultSecretsOfficerRoleId
  }
}

output apiName string = api.name
output apiUri string = 'https://${api.properties.defaultHostName}'
output sqlServerName string = sqlServer.name
output sqlDatabaseName string = sqlDatabase.name
output keyVaultName string = keyVault.name
output applicationInsightsConnectionString string = applicationInsights.properties.ConnectionString
