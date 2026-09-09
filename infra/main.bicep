targetScope = 'subscription'

@minLength(1)
@maxLength(64)
@description('Azure Developer CLI environment name.')
param environmentName string

@description('Azure region for the resource group and all resources.')
param location string

@description('Resource group used for this portfolio deployment.')
param resourceGroupName string = 'rg-aws-file-analyzer-portfolio'

@description('Object ID of the developer who administers Azure SQL and deployment secrets.')
param principalId string

@description('Microsoft Entra sign-in name of the Azure SQL administrator.')
param principalName string

@description('Microsoft Entra tenant ID.')
param tenantId string

@description('Cloudflare Pages origin allowed by the API CORS policy.')
param cloudflareAllowedOrigin string

@description('Optional public IPv4 address used only for deployment-time SQL administration.')
param deployerIpAddress string = ''

var tags = {
  'azd-env-name': environmentName
  application: 'aws-file-analyzer'
  environment: environmentName
  workload: 'portfolio'
}

resource resourceGroup 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: resourceGroupName
  location: location
  tags: tags
}

module resources './resources.bicep' = {
  name: 'aws-file-analyzer-resources'
  scope: resourceGroup
  params: {
    environmentName: environmentName
    location: location
    tags: tags
    principalId: principalId
    principalName: principalName
    tenantId: tenantId
    cloudflareAllowedOrigin: cloudflareAllowedOrigin
    deployerIpAddress: deployerIpAddress
  }
}

output AZURE_LOCATION string = location
output AZURE_RESOURCE_GROUP string = resourceGroup.name
output AZURE_TENANT_ID string = tenantId
output SERVICE_API_NAME string = resources.outputs.apiName
output SERVICE_API_URI string = resources.outputs.apiUri
output SQL_SERVER string = resources.outputs.sqlServerName
output SQL_DATABASE string = resources.outputs.sqlDatabaseName
output AZURE_KEY_VAULT_NAME string = resources.outputs.keyVaultName
output APPLICATIONINSIGHTS_CONNECTION_STRING string = resources.outputs.applicationInsightsConnectionString
