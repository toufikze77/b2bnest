# Todo Hub - CodePen Demo

You can copy this code to CodePen.io to see a live preview:

## HTML (Copy to HTML section):

```html
<div class="bg-gray-50 min-h-screen">
  <!-- Header -->
  <div class="bg-white border-b border-gray-200">
    <div class="max-w-7xl mx-auto px-4 py-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-4">
          <h1 class="text-2xl font-bold text-gray-900">Todo Hub</h1>
          <span class="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded">
            Connected to 5 apps
          </span>
        </div>
        
        <div class="flex items-center space-x-4">
          <input type="text" placeholder="Search tasks..." class="px-4 py-2 border rounded-md w-64">
          <button class="relative p-2 text-gray-400">
            🔔
            <span class="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">3</span>
          </button>
          <button class="bg-blue-600 text-white px-4 py-2 rounded-md">➕ New Task</button>
        </div>
      </div>
    </div>
  </div>

  <!-- Stats -->
  <div class="max-w-7xl mx-auto px-4 py-8">
    <div class="grid grid-cols-4 gap-6 mb-8">
      <div class="bg-white p-6 rounded-lg shadow">
        <div class="flex items-center">
          <div class="p-2 bg-blue-100 rounded-lg">📅</div>
          <div class="ml-4">
            <p class="text-sm text-gray-600">Today's Tasks</p>
            <p class="text-2xl font-bold">12</p>
          </div>
        </div>
      </div>
      
      <div class="bg-white p-6 rounded-lg shadow">
        <div class="flex items-center">
          <div class="p-2 bg-green-100 rounded-lg">👥</div>
          <div class="ml-4">
            <p class="text-sm text-gray-600">Team Tasks</p>
            <p class="text-2xl font-bold">28</p>
          </div>
        </div>
      </div>
      
      <div class="bg-white p-6 rounded-lg shadow">
        <div class="flex items-center">
          <div class="p-2 bg-purple-100 rounded-lg">⚡</div>
          <div class="ml-4">
            <p class="text-sm text-gray-600">Automated</p>
            <p class="text-2xl font-bold">45</p>
          </div>
        </div>
      </div>
      
      <div class="bg-white p-6 rounded-lg shadow">
        <div class="flex items-center">
          <div class="p-2 bg-orange-100 rounded-lg">📊</div>
          <div class="ml-4">
            <p class="text-sm text-gray-600">Completion</p>
            <p class="text-2xl font-bold">87%</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="mb-6">
      <div class="border-b border-gray-200">
        <nav class="flex space-x-8">
          <button onclick="showTab('tasks')" id="tab-tasks" class="py-2 px-1 border-b-2 border-blue-500 font-medium text-blue-600">Tasks</button>
          <button onclick="showTab('integrations')" id="tab-integrations" class="py-2 px-1 border-b-2 border-transparent font-medium text-gray-500">Integrations</button>
          <button onclick="showTab('analytics')" id="tab-analytics" class="py-2 px-1 border-b-2 border-transparent font-medium text-gray-500">Analytics</button>
        </nav>
      </div>
    </div>

    <!-- Tasks Tab -->
    <div id="content-tasks" class="tab-content">
      <div class="space-y-4">
        <!-- Task 1 -->
        <div class="bg-white rounded-lg shadow p-4 border-l-4 border-orange-500">
          <div class="flex items-start space-x-3">
            <input type="checkbox" class="mt-1">
            <div class="flex-1">
              <div class="flex items-center space-x-2 mb-2">
                <span>🎨</span>
                <h4 class="font-medium">Review Figma design mockups</h4>
                <span class="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded">HIGH</span>
              </div>
              <p class="text-sm text-gray-600 mb-2">Check the new landing page designs and provide feedback</p>
              <div class="flex items-center space-x-4 text-sm text-gray-500">
                <span>📅 Jan 15</span>
                <span>👤 John Doe</span>
                <span>⏱️ 120min</span>
              </div>
              <div class="mt-2 text-xs text-blue-600">🎨 Figma: Landing Page V2</div>
            </div>
          </div>
        </div>

        <!-- Task 2 -->
        <div class="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-500">
          <div class="flex items-start space-x-3">
            <input type="checkbox" class="mt-1">
            <div class="flex-1">
              <div class="flex items-center space-x-2 mb-2">
                <span>📁</span>
                <h4 class="font-medium">Sync with OneDrive documents</h4>
                <span class="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded">MEDIUM</span>
              </div>
              <p class="text-sm text-gray-600 mb-2">Update project documentation in shared folder</p>
              <div class="flex items-center space-x-4 text-sm text-gray-500">
                <span>📅 Jan 16</span>
                <span>⏱️ 60min</span>
              </div>
              <div class="mt-2 text-xs text-blue-600">💼 OneDrive: Project Docs/Requirements.docx</div>
            </div>
          </div>
        </div>

        <!-- Task 3 -->
        <div class="bg-white rounded-lg shadow p-4 border-l-4 border-green-500 opacity-60">
          <div class="flex items-start space-x-3">
            <input type="checkbox" checked class="mt-1">
            <div class="flex-1">
              <div class="flex items-center space-x-2 mb-2">
                <span>💬</span>
                <h4 class="font-medium line-through">Respond to Slack team discussion</h4>
                <span class="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">COMPLETED</span>
              </div>
              <p class="text-sm text-gray-600 mb-2 line-through">Address questions about feature implementation</p>
              <div class="flex items-center space-x-4 text-sm text-gray-500">
                <span>👤 Jane Smith</span>
                <span>⏱️ 30min</span>
              </div>
              <div class="mt-2 text-xs text-blue-600">💬 Slack: #development</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Integrations Tab -->
    <div id="content-integrations" class="tab-content hidden">
      <div class="grid grid-cols-2 gap-6">
        <!-- Connected Apps -->
        <div class="bg-white rounded-lg shadow p-6">
          <h3 class="text-lg font-medium mb-4">Connected Apps (3)</h3>
          
          <div class="space-y-4">
            <div class="border rounded-lg p-4">
              <div class="flex items-center justify-between mb-2">
                <div class="flex items-center space-x-3">
                  <span class="text-2xl">💬</span>
                  <div>
                    <h4 class="font-medium">Slack</h4>
                    <p class="text-sm text-gray-600">Message to task conversion</p>
                  </div>
                </div>
                <span class="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">✅ Connected</span>
              </div>
              <div class="text-sm text-gray-500">Last Sync: 2 hours ago | Tasks Created: 23</div>
            </div>

            <div class="border rounded-lg p-4">
              <div class="flex items-center justify-between mb-2">
                <div class="flex items-center space-x-3">
                  <span class="text-2xl">📁</span>
                  <div>
                    <h4 class="font-medium">OneDrive</h4>
                    <p class="text-sm text-gray-600">Document tracking</p>
                  </div>
                </div>
                <span class="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">✅ Connected</span>
              </div>
              <div class="text-sm text-gray-500">Last Sync: 1 hour ago | Tasks Created: 12</div>
            </div>

            <div class="border rounded-lg p-4">
              <div class="flex items-center justify-between mb-2">
                <div class="flex items-center space-x-3">
                  <span class="text-2xl">🎨</span>
                  <div>
                    <h4 class="font-medium">Figma</h4>
                    <p class="text-sm text-gray-600">Design comment tracking</p>
                  </div>
                </div>
                <span class="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">✅ Connected</span>
              </div>
              <div class="text-sm text-gray-500">Last Sync: 30 min ago | Tasks Created: 8</div>
            </div>
          </div>
        </div>

        <!-- Available Apps -->
        <div class="bg-white rounded-lg shadow p-6">
          <h3 class="text-lg font-medium mb-4">Available Apps (3)</h3>
          
          <div class="space-y-4">
            <div class="border rounded-lg p-4">
              <div class="flex items-center justify-between">
                <div class="flex items-center space-x-3">
                  <span class="text-2xl">🤖</span>
                  <div>
                    <h4 class="font-medium">ChatGPT</h4>
                    <p class="text-sm text-gray-600">AI-powered suggestions</p>
                  </div>
                </div>
                <button class="bg-blue-600 text-white px-3 py-1 rounded text-sm">Connect</button>
              </div>
            </div>

            <div class="border rounded-lg p-4">
              <div class="flex items-center justify-between">
                <div class="flex items-center space-x-3">
                  <span class="text-2xl">🐙</span>
                  <div>
                    <h4 class="font-medium">GitHub</h4>
                    <p class="text-sm text-gray-600">Issue tracking</p>
                  </div>
                </div>
                <button class="bg-blue-600 text-white px-3 py-1 rounded text-sm">Connect</button>
              </div>
            </div>

            <div class="border rounded-lg p-4">
              <div class="flex items-center justify-between">
                <div class="flex items-center space-x-3">
                  <span class="text-2xl">📧</span>
                  <div>
                    <h4 class="font-medium">Gmail</h4>
                    <p class="text-sm text-gray-600">Email to task</p>
                  </div>
                </div>
                <button class="bg-blue-600 text-white px-3 py-1 rounded text-sm">Connect</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Analytics Tab -->
    <div id="content-analytics" class="tab-content hidden">
      <div class="bg-white rounded-lg shadow p-6">
        <h3 class="text-lg font-medium mb-4">Analytics Dashboard</h3>
        
        <div class="grid grid-cols-4 gap-4 mb-6">
          <div class="text-center">
            <div class="text-2xl font-bold">156</div>
            <div class="text-sm text-gray-600">Total Tasks</div>
            <div class="text-xs text-green-600">📈 12% up</div>
          </div>
          <div class="text-center">
            <div class="text-2xl font-bold">85.9%</div>
            <div class="text-sm text-gray-600">Completion Rate</div>
            <div class="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div class="bg-green-500 h-2 rounded-full" style="width: 85.9%"></div>
            </div>
          </div>
          <div class="text-center">
            <div class="text-2xl font-bold">2.3h</div>
            <div class="text-sm text-gray-600">Avg. Time</div>
          </div>
          <div class="text-center">
            <div class="text-2xl font-bold text-red-600">8</div>
            <div class="text-sm text-gray-600">Overdue</div>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-6">
          <div>
            <h4 class="font-medium mb-3">📈 Key Insights</h4>
            <div class="p-3 bg-green-50 border border-green-200 rounded-lg mb-3">
              <p class="text-sm font-medium text-green-800">🎯 High Performance</p>
              <p class="text-sm text-green-700">Completion rate 15% higher than average!</p>
            </div>
            <div class="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p class="text-sm font-medium text-blue-800">⚡ Integration Success</p>
              <p class="text-sm text-blue-700">Slack creates the most actionable tasks.</p>
            </div>
          </div>
          
          <div>
            <h4 class="font-medium mb-3">🎯 Recommendations</h4>
            <div class="p-3 border rounded-lg mb-3">
              <p class="text-sm font-medium">Schedule focused time blocks</p>
              <p class="text-sm text-gray-600">10 AM is your most productive time.</p>
            </div>
            <div class="p-3 border rounded-lg">
              <p class="text-sm font-medium">Enable more integrations</p>
              <p class="text-sm text-gray-600">Connect GitHub and Calendar.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
```

## CSS (Copy to CSS section):

```css
@import url('https://cdn.tailwindcss.com');

.tab-content.hidden {
  display: none;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
```

## JavaScript (Copy to JS section):

```javascript
function showTab(tabName) {
  // Hide all tab contents
  const contents = document.querySelectorAll('.tab-content');
  contents.forEach(content => content.classList.add('hidden'));
  
  // Show selected tab content
  document.getElementById('content-' + tabName).classList.remove('hidden');
  
  // Update tab styles
  const tabs = document.querySelectorAll('[id^="tab-"]');
  tabs.forEach(tab => {
    tab.className = 'py-2 px-1 border-b-2 border-transparent font-medium text-gray-500';
  });
  
  // Activate selected tab
  const activeTab = document.getElementById('tab-' + tabName);
  activeTab.className = 'py-2 px-1 border-b-2 border-blue-500 font-medium text-blue-600';
}
```

## How to Use:
1. Go to https://codepen.io/pen/
2. Copy the HTML code to the HTML section
3. Copy the CSS code to the CSS section  
4. Copy the JavaScript code to the JS section
5. Click "Run" to see the live preview

This creates a fully interactive Todo Hub demo online!