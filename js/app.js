/*global jQuery, Handlebars */
jQuery(function ($) {
	'use strict';

	Handlebars.registerHelper('eq', function(a, b, options) {
		return a === b ? options.fn(this) : options.inverse(this);
	});

	var ENTER_KEY = 13;
	var ESCAPE_KEY = 27;

	var util = {
		getApiKey: function () {
			var key = localStorage.getItem("github_key");
			if (!key) {
				key = prompt('What is your GitHub API key?');
				localStorage.setItem("github_key", key);
			}
			return key;
		},

		pluralize: function (count, word) {
			return count === 1 ? word : word + 's';
		}
	};

	var App = {
		init: function () {
			this.todos = [];
			$.getJSON( "https://api.github.com/repos/wildcatz/TodoMVC/issues?access_token=" + util.getApiKey(),
								 this.createIssuesCallback.bind(this));
			this.cacheElements();
			this.bindEvents();

			Router({
				'/:filter': function (filter) {
					this.filter = filter;
					this.render();
				}.bind(this)
			}).init('/all');
		},
		createIssuesCallback: function( data ) {
			$.each ( data, function( key, object ) {
				if(!object.pull_request)
					this.todos.push({id: object.number, title: object.title, body: object.body});
			}.bind(this));
			this.render();
		},
		cacheElements: function () {
			this.todoTemplate = Handlebars.compile($('#todo-template').html());
			this.footerTemplate = Handlebars.compile($('#footer-template').html());
			this.$todoApp = $('#todoapp');
			this.$header = this.$todoApp.find('#header');
			this.$main = this.$todoApp.find('#main');
			this.$footer = this.$todoApp.find('#footer');
			this.$newTodo = this.$header.find('#new-todo');
			this.$newTodoBody = this.$header.find('#new-todo-body');
			this.$toggleAll = this.$main.find('#toggle-all');
			this.$todoList = this.$main.find('#todo-list');
			this.$count = this.$footer.find('#todo-count');
			this.$clearBtn = this.$footer.find('#clear-completed');
		},
		bindEvents: function () {
			var list = this.$todoList;
			this.$newTodo.on('keyup', this.create.bind(this));
			this.$newTodoBody.on('keyup', this.create.bind(this));
			this.$toggleAll.on('change', this.toggleAll.bind(this));
			this.$footer.on('click', '#clear-completed', this.destroyCompleted.bind(this));
			list.on('change', '.toggle', this.toggle.bind(this));
			list.on('dblclick', 'label', this.edit.bind(this));
			list.on('keyup', '.edit', this.editKeyup.bind(this));
			list.on('keyup', '.edit-body', this.editKeyup.bind(this));
			list.on('focusout', '.edit', this.exitEdit.bind(this));
			list.on('focusout', '.edit-body', this.exitEdit.bind(this));
		},
		render: function () {
			var todos = this.getFilteredTodos();
			this.$todoList.html(this.todoTemplate(todos));
			this.$main.toggle(todos.length > 0);
			this.$toggleAll.prop('checked', this.getActiveTodos().length === 0);
			this.renderFooter();
		},
		renderFooter: function () {
			var todoCount = this.todos.length;
			var activeTodoCount = this.getActiveTodos().length;
			var completedTodoCount = todoCount - activeTodoCount;
			var template = this.footerTemplate({
				activeTodoCount: activeTodoCount,
				activeTodoWord: util.pluralize(activeTodoCount, 'issue'),
				completedTodos: completedTodoCount,
				completedTodoWord: util.pluralize(completedTodoCount, 'issue'),
				filter: this.filter
			});

			this.$footer.toggle(todoCount > 0).html(template);
		},
		toggleAll: function (e) {
			var isChecked = $(e.target).prop('checked');

			this.todos.forEach(function (todo) {
				todo.completed = isChecked;
			});

			this.render();
		},
		getActiveTodos: function () {
			return this.todos.filter(function (todo) {
				return !todo.completed;
			});
		},
		getCompletedTodos: function () {
			return this.todos.filter(function (todo) {
				return todo.completed;
			});
		},
		getFilteredTodos: function () {
			if (this.filter === 'active') {
				return this.getActiveTodos();
			}

			if (this.filter === 'completed') {
				return this.getCompletedTodos();
			}

			return this.todos;
		},
		destroyCompleted: function () {
			var finishedTodos = this.getCompletedTodos();
			$.each(finishedTodos, function(key, todo) {
				$.post("https://api.github.com/repos/wildcatz/TodoMVC/issues/" + todo.id + "?access_token=" + util.getApiKey(),
							 JSON.stringify({ state: 'closed' }));
			}.bind(this));

			this.todos = this.getActiveTodos();
			this.filter = 'all';
			this.render();
		},
		// accepts an element from inside the `.item` div and
		// returns the corresponding index in the `todos` array
		indexFromEl: function (el) {
			var id = $(el).closest('li').data('id');
			var todos = this.todos;
			var i = todos.length;

			while (i--) {
				if (todos[i].id === id) {
					return i;
				}
			}
		},
		create: function (e) {
			var title = this.$newTodo.val().trim();
			var body = this.$newTodoBody.val().trim();

			if (e.which !== ENTER_KEY || !title) {
				return;
			}

			$.post("https://api.github.com/repos/wildcatz/TodoMVC/issues?access_token=" + util.getApiKey(),
						 JSON.stringify({ "title": title, "body": body }),
						 this.createCallback.bind(this),
						 "json");
		},
		createCallback: function data(data) {
			this.todos.unshift({
				id: data.number,
				title: data.title,
				body: data.body,
				completed: false
			});

			this.$newTodo.val('');
			this.$newTodoBody.val('');

			this.render();
		},
		toggle: function (e) {
			var i = this.indexFromEl(e.target);
			this.todos[i].completed = !this.todos[i].completed;
			this.render();
		},
		edit: function (e) {
			if ($(e.target).hasClass("edit")) {
				var $title = $(e.target).closest('li').addClass('editing').find('.edit');
				$title.focus();
			} else {
				var $body = $(e.target).closest('li').addClass('editing').find('.edit-body');
				$body.focus();
			}
		},
		editKeyup: function (e) {
			if (e.which === ENTER_KEY) {
				this.update(e);
				e.target.blur();
			}

			if (e.which === ESCAPE_KEY) {
				this.exitEdit(e);
			}
		},
		exitEdit: function (e) {
			var $el = $(e.target);
			var $title, $body;
			if ($el.hasClass("edit")) {
				$title = $el;
				$body = $title.siblings(".edit-body");
			}
			else {
				$body = $el;
				$title = $body.siblings(".edit");
			}
			$title.closest('li').removeClass('editing');
			$body.closest('li').removeClass('editing');
		},
		update: function (e) {
			var el = e.target;
			var $el = $(el);
			var $title, $body;

			if ($el.hasClass("edit")) {
				$title = $el;
				$body = $title.siblings(".edit-body");
			}
			else {
				$body = $el;
				$title = $body.siblings(".edit");
			}

			var title = $title.val().trim();
			var body = $body.val().trim();

			var i = this.indexFromEl(el);

			if (title || body) {
				this.todos[i].title = title;
				this.todos[i].body = body;
			}

			$.post("https://api.github.com/repos/wildcatz/TodoMVC/issues/" + (this.todos[i].id) + "?access_token=" + util.getApiKey(),
						 JSON.stringify({ "title": title, "body": body }),
						 this.createCallback.bind(this),
						 "json");

			this.render();
		}
	};

	window.app = App;
	App.init();
});
