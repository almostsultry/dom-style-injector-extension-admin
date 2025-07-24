// SharePoint service for customizations storage and management
import { getAccessToken } from '../auth/auth-service.js';
import { sharepointConfig } from '../auth/msal-config.js';

class SharePointService {
  constructor() {
    this.apiEndpoint = 'https://graph.microsoft.com/v1.0';
    this.siteUrl = 'https://company.sharepoint.com/sites/customizations'; // Default site URL
    this.listName = sharepointConfig.listName;
    this.siteId = null;
    this.listId = null;
  }

  // Initialize service by getting site and list IDs
  async initialize() {
    try {
      if (!this.siteId) {
        this.siteId = await this.getSiteId();
      }
      
      if (!this.listId) {
        this.listId = await this.getListId();
      }
      
      console.log('SharePoint service initialized successfully');
      return true;
      
    } catch (error) {
      console.error('SharePoint service initialization failed:', error);
      throw error;
    }
  }

  // Get SharePoint site ID
  async getSiteId() {
    try {
      const accessToken = await getAccessToken();
      const siteUrlParts = this.siteUrl.replace('https://', '').split('/');
      const hostname = siteUrlParts[0];
      const sitePath = siteUrlParts.slice(1).join('/');
      
      const response = await fetch(
        `${this.apiEndpoint}/sites/${hostname}:/${sitePath}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.ok) {
        throw new Error(`Failed to get site ID: ${response.status} ${response.statusText}`);
      }
      
      const siteData = await response.json();
      console.log('Retrieved SharePoint site ID:', siteData.id);
      
      return siteData.id;
      
    } catch (error) {
      console.error('Error getting SharePoint site ID:', error);
      throw error;
    }
  }

  // Get SharePoint list ID
  async getListId() {
    try {
      const accessToken = await getAccessToken();
      
      const response = await fetch(
        `${this.apiEndpoint}/sites/${this.siteId}/lists?$filter=displayName eq '${this.listName}'`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.ok) {
        throw new Error(`Failed to get list ID: ${response.status} ${response.statusText}`);
      }
      
      const listData = await response.json();
      
      if (listData.value.length === 0) {
        // List doesn't exist, create it
        console.log(`List '${this.listName}' not found, creating...`);
        return await this.createCustomizationsList();
      }
      
      const listId = listData.value[0].id;
      console.log('Retrieved SharePoint list ID:', listId);
      
      return listId;
      
    } catch (error) {
      console.error('Error getting SharePoint list ID:', error);
      throw error;
    }
  }

  // Create the customizations list if it doesn't exist
  async createCustomizationsList() {
    try {
      const accessToken = await getAccessToken();
      
      // Create the list
      const listDefinition = {
        displayName: this.listName,
        description: 'Storage for DOM Style Injector customizations',
        template: 'genericList'
      };
      
      const response = await fetch(
        `${this.apiEndpoint}/sites/${this.siteId}/lists`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(listDefinition)
        }
      );
      
      if (!response.ok) {
        throw new Error(`Failed to create list: ${response.status} ${response.statusText}`);
      }
      
      const newList = await response.json();
      console.log('Created SharePoint list:', newList.displayName);
      
      // Add custom columns
      await this.createCustomColumns(newList.id);
      
      return newList.id;
      
    } catch (error) {
      console.error('Error creating SharePoint list:', error);
      throw error;
    }
  }

  // Create custom columns for the list
  async createCustomColumns(listId) {
    try {
      const accessToken = await getAccessToken();
      
      const columns = [
        {
          name: 'CustomizationData',
          description: 'JSON data containing the customizations',
          text: {
            allowMultipleLines: true,
            appendChangesToExistingText: false,
            linesForEditing: 10,
            maxLength: 255000
          }
        },
        {
          name: 'Version',
          description: 'Version number for this customization',
          number: {
            decimalPlaces: 0,
            displayAs: 'number',
            maximum: 999999,
            minimum: 1
          }
        },
        {
          name: 'IsActive',
          description: 'Whether this customization is active',
          boolean: {}
        },
        {
          name: 'ApprovalStatus',
          description: 'Approval status of the customization',
          choice: {
            allowTextEntry: false,
            choices: sharepointConfig.choiceFields.ApprovalStatus,
            displayAs: 'dropDownMenu'
          }
        },
        {
          name: 'Category',
          description: 'Category of the customization',
          choice: {
            allowTextEntry: true,
            choices: sharepointConfig.choiceFields.Category,
            displayAs: 'dropDownMenu'
          }
        },
        {
          name: 'Priority',
          description: 'Priority level of the customization',
          choice: {
            allowTextEntry: false,
            choices: sharepointConfig.choiceFields.Priority,
            displayAs: 'dropDownMenu'
          }
        },
        {
          name: 'Description',
          description: 'Human-readable description of the customization',
          text: {
            allowMultipleLines: true,
            appendChangesToExistingText: false,
            linesForEditing: 3,
            maxLength: 1000
          }
        }
      ];
      
      for (const column of columns) {
        await this.createColumn(listId, column, accessToken);
      }
      
      console.log('Custom columns created successfully');
      
    } catch (error) {
      console.error('Error creating custom columns:', error);
      throw error;
    }
  }

  // Create a single column
  async createColumn(listId, columnDefinition, accessToken) {
    try {
      const response = await fetch(
        `${this.apiEndpoint}/sites/${this.siteId}/lists/${listId}/columns`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(columnDefinition)
        }
      );
      
      if (!response.ok) {
        // Column might already exist, which is okay
        if (response.status === 409) {
          console.log(`Column ${columnDefinition.name} already exists`);
          return;
        }
        throw new Error(`Failed to create column ${columnDefinition.name}: ${response.status}`);
      }
      
      const column = await response.json();
      console.log(`Created column: ${column.name}`);
      
    } catch (error) {
      console.error(`Error creating column ${columnDefinition.name}:`, error);
      // Don't throw - continue with other columns
    }
  }

  // Get all customizations from SharePoint
  async getCustomizations(filter = null) {
    try {
      await this.initialize();
      const accessToken = await getAccessToken();
      
      let url = `${this.apiEndpoint}/sites/${this.siteId}/lists/${this.listId}/items?$expand=fields`;
      
      // Combine filters properly
      const activeFilter = "fields/IsActive eq true";
      const combinedFilter = filter ? `${filter} and ${activeFilter}` : activeFilter;
      url += `&$filter=${encodeURIComponent(combinedFilter)}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to get customizations: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Transform SharePoint items to our format
      const customizations = data.value.map(item => ({
        Id: item.id,
        Title: item.fields.Title,
        CustomizationData: item.fields.CustomizationData,
        Version: item.fields.Version,
        IsActive: item.fields.IsActive,
        ApprovalStatus: item.fields.ApprovalStatus,
        Category: item.fields.Category,
        Priority: item.fields.Priority,
        Description: item.fields.Description,
        Created: item.createdDateTime,
        Modified: item.lastModifiedDateTime,
        CreatedBy: item.createdBy?.user?.displayName,
        ModifiedBy: item.lastModifiedBy?.user?.displayName
      }));
      
      console.log(`Retrieved ${customizations.length} customizations from SharePoint`);
      return customizations;
      
    } catch (error) {
      console.error('Error getting customizations from SharePoint:', error);
      throw error;
    }
  }

  // Get a specific customization by ID
  async getCustomization(itemId) {
    try {
      await this.initialize();
      const accessToken = await getAccessToken();
      
      const response = await fetch(
        `${this.apiEndpoint}/sites/${this.siteId}/lists/${this.listId}/items/${itemId}?$expand=fields`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.ok) {
        throw new Error(`Failed to get customization: ${response.status} ${response.statusText}`);
      }
      
      const item = await response.json();
      
      return {
        Id: item.id,
        Title: item.fields.Title,
        CustomizationData: item.fields.CustomizationData,
        Version: item.fields.Version,
        IsActive: item.fields.IsActive,
        ApprovalStatus: item.fields.ApprovalStatus,
        Category: item.fields.Category,
        Priority: item.fields.Priority,
        Description: item.fields.Description,
        Created: item.createdDateTime,
        Modified: item.lastModifiedDateTime,
        CreatedBy: item.createdBy?.user?.displayName,
        ModifiedBy: item.lastModifiedBy?.user?.displayName
      };
      
    } catch (error) {
      console.error(`Error getting customization ${itemId}:`, error);
      throw error;
    }
  }

  // Create a new customization in SharePoint
  async createCustomization(customizationData) {
    try {
      await this.initialize();
      const accessToken = await getAccessToken();
      
      const itemData = {
        fields: {
          Title: customizationData.Title,
          CustomizationData: customizationData.CustomizationData,
          Version: customizationData.Version || 1,
          IsActive: customizationData.IsActive !== false,
          ApprovalStatus: customizationData.ApprovalStatus || 'Draft',
          Category: customizationData.Category || 'Custom',
          Priority: customizationData.Priority || 'Medium',
          Description: customizationData.Description || ''
        }
      };
      
      const response = await fetch(
        `${this.apiEndpoint}/sites/${this.siteId}/lists/${this.listId}/items`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(itemData)
        }
      );
      
      if (!response.ok) {
        throw new Error(`Failed to create customization: ${response.status} ${response.statusText}`);
      }
      
      const newItem = await response.json();
      console.log(`Created customization: ${customizationData.Title}`);
      
      return {
        Id: newItem.id,
        Title: newItem.fields.Title,
        ...customizationData
      };
      
    } catch (error) {
      console.error('Error creating customization:', error);
      throw error;
    }
  }

  // Update an existing customization
  async updateCustomization(itemId, updates) {
    try {
      await this.initialize();
      const accessToken = await getAccessToken();
      
      const updateData = {
        fields: {}
      };
      
      // Map update fields
      if (updates.CustomizationData !== undefined) {
        updateData.fields.CustomizationData = updates.CustomizationData;
      }
      if (updates.Version !== undefined) {
        updateData.fields.Version = updates.Version;
      }
      if (updates.IsActive !== undefined) {
        updateData.fields.IsActive = updates.IsActive;
      }
      if (updates.ApprovalStatus !== undefined) {
        updateData.fields.ApprovalStatus = updates.ApprovalStatus;
      }
      if (updates.Category !== undefined) {
        updateData.fields.Category = updates.Category;
      }
      if (updates.Priority !== undefined) {
        updateData.fields.Priority = updates.Priority;
      }
      if (updates.Description !== undefined) {
        updateData.fields.Description = updates.Description;
      }
      
      const response = await fetch(
        `${this.apiEndpoint}/sites/${this.siteId}/lists/${this.listId}/items/${itemId}`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(updateData)
        }
      );
      
      if (!response.ok) {
        throw new Error(`Failed to update customization: ${response.status} ${response.statusText}`);
      }
      
      const updatedItem = await response.json();
      console.log(`Updated customization: ${itemId}`);
      
      return updatedItem;
      
    } catch (error) {
      console.error(`Error updating customization ${itemId}:`, error);
      throw error;
    }
  }

  // Delete a customization (soft delete by setting IsActive = false)
  async deleteCustomization(itemId, hardDelete = false) {
    try {
      await this.initialize();
      const accessToken = await getAccessToken();
      
      if (hardDelete) {
        // Hard delete - actually remove the item
        const response = await fetch(
          `${this.apiEndpoint}/sites/${this.siteId}/lists/${this.listId}/items/${itemId}`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${accessToken}`
            }
          }
        );
        
        if (!response.ok) {
          throw new Error(`Failed to delete customization: ${response.status} ${response.statusText}`);
        }
        
        console.log(`Hard deleted customization: ${itemId}`);
        
      } else {
        // Soft delete - set IsActive to false
        await this.updateCustomization(itemId, { IsActive: false });
        console.log(`Soft deleted customization: ${itemId}`);
      }
      
      return true;
      
    } catch (error) {
      console.error(`Error deleting customization ${itemId}:`, error);
      throw error;
    }
  }

  // Search customizations
  async searchCustomizations(searchTerm, category = null) {
    try {
      let filter = `(substringof('${searchTerm}', fields/Title) or substringof('${searchTerm}', fields/Description)) and fields/IsActive eq true`;
      
      if (category) {
        filter += ` and fields/Category eq '${category}'`;
      }
      
      return await this.getCustomizations(filter);
      
    } catch (error) {
      console.error('Error searching customizations:', error);
      throw error;
    }
  }

  // Get customizations by approval status
  async getCustomizationsByStatus(status) {
    try {
      const filter = `fields/ApprovalStatus eq '${status}' and fields/IsActive eq true`;
      return await this.getCustomizations(filter);
      
    } catch (error) {
      console.error(`Error getting customizations by status ${status}:`, error);
      throw error;
    }
  }

  // Approve a customization
  async approveCustomization(itemId, approverComments = '') {
    try {
      const updates = {
        ApprovalStatus: 'Approved',
        Description: approverComments ? `${approverComments}\n\n[Previous description preserved above]` : undefined
      };
      
      return await this.updateCustomization(itemId, updates);
      
    } catch (error) {
      console.error(`Error approving customization ${itemId}:`, error);
      throw error;
    }
  }

  // Reject a customization
  async rejectCustomization(itemId, rejectionReason) {
    try {
      const updates = {
        ApprovalStatus: 'Rejected',
        Description: `REJECTED: ${rejectionReason}\n\n[Previous description preserved above]`
      };
      
      return await this.updateCustomization(itemId, updates);
      
    } catch (error) {
      console.error(`Error rejecting customization ${itemId}:`, error);
      throw error;
    }
  }

  // Get customization statistics
  async getStatistics() {
    try {
      const allCustomizations = await this.getCustomizations();
      
      const stats = {
        total: allCustomizations.length,
        byStatus: {},
        byCategory: {},
        byPriority: {},
        recent: allCustomizations.filter(item => {
          const modified = new Date(item.Modified);
          const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          return modified > weekAgo;
        }).length
      };
      
      // Count by status
      allCustomizations.forEach(item => {
        stats.byStatus[item.ApprovalStatus] = (stats.byStatus[item.ApprovalStatus] || 0) + 1;
        stats.byCategory[item.Category] = (stats.byCategory[item.Category] || 0) + 1;
        stats.byPriority[item.Priority] = (stats.byPriority[item.Priority] || 0) + 1;
      });
      
      return stats;
      
    } catch (error) {
      console.error('Error getting statistics:', error);
      throw error;
    }
  }

  // Test connection to SharePoint
  async testConnection() {
    try {
      await this.initialize();
      const accessToken = await getAccessToken();
      
      // Try to get site information
      const response = await fetch(
        `${this.apiEndpoint}/sites/${this.siteId}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.ok) {
        throw new Error(`Connection test failed: ${response.status} ${response.statusText}`);
      }
      
      const siteData = await response.json();
      
      return {
        success: true,
        siteTitle: siteData.displayName,
        siteUrl: siteData.webUrl,
        listName: this.listName,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('SharePoint connection test failed:', error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

// Export singleton instance
export const sharePointService = new SharePointService();